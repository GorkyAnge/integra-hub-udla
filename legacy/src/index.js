/**
 * IntegraHub - Legacy CSV File Processor
 * Watches inbox folder and processes CSV files automatically
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const chokidar = require('chokidar');
const { v4: uuidv4 } = require('uuid');

const logger = require('./utils/logger');
const { connectDatabase, pool } = require('./config/database');
const { connectRabbitMQ, publishEvent } = require('./config/rabbitmq');

const INBOX_PATH = process.env.INBOX_PATH || './inbox';
const PROCESSED_PATH = process.env.PROCESSED_PATH || './processed';
const ERROR_PATH = process.env.ERROR_PATH || './error';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 10000;

// Ensure directories exist
[INBOX_PATH, PROCESSED_PATH, ERROR_PATH].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Process a CSV file
 */
async function processCSVFile(filePath) {
  const filename = path.basename(filePath);
  const importId = uuidv4();
  
  logger.info(`Processing CSV file: ${filename}`);

  // Record import start
  await pool.query(
    `INSERT INTO inventory.csv_imports (id, filename, status, started_at)
     VALUES ($1, $2, 'PROCESSING', NOW())`,
    [importId, filename]
  );

  const records = [];
  const errors = [];
  let totalRecords = 0;
  let processedRecords = 0;
  let failedRecords = 0;

  return new Promise((resolve, reject) => {
    const parser = fs.createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: true
      })
    );

    parser.on('data', (record) => {
      totalRecords++;
      records.push(record);
    });

    parser.on('error', async (error) => {
      logger.error(`Error parsing CSV: ${error.message}`);
      errors.push({ line: totalRecords, error: error.message });
    });

    parser.on('end', async () => {
      logger.info(`Parsed ${totalRecords} records from ${filename}`);

      // Process records
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        try {
          await processRecord(record, i + 1);
          processedRecords++;
        } catch (error) {
          failedRecords++;
          errors.push({
            line: i + 2, // +2 for header and 0-index
            record,
            error: error.message
          });
          logger.warn(`Failed to process record at line ${i + 2}: ${error.message}`);
        }
      }

      // Update import status
      const status = failedRecords === 0 ? 'COMPLETED' : (processedRecords > 0 ? 'PARTIAL' : 'FAILED');
      
      await pool.query(
        `UPDATE inventory.csv_imports 
         SET status = $1, total_records = $2, processed_records = $3, 
             failed_records = $4, error_details = $5, completed_at = NOW()
         WHERE id = $6`,
        [status, totalRecords, processedRecords, failedRecords, JSON.stringify(errors), importId]
      );

      // Move file to processed or error folder
      const destFolder = failedRecords === totalRecords ? ERROR_PATH : PROCESSED_PATH;
      const destPath = path.join(destFolder, `${Date.now()}_${filename}`);
      
      try {
        fs.renameSync(filePath, destPath);
        logger.info(`Moved ${filename} to ${destFolder}`);
      } catch (moveError) {
        logger.error(`Failed to move file: ${moveError.message}`);
      }

      // Publish import completed event
      await publishEvent('analytics.exchange', 'analytics.csv.import', {
        messageId: uuidv4(),
        eventType: 'CSVImportCompleted',
        importId,
        filename,
        status,
        totalRecords,
        processedRecords,
        failedRecords,
        timestamp: new Date().toISOString()
      });

      logger.info(`CSV import completed: ${filename} - ${processedRecords}/${totalRecords} records processed`);
      resolve({ importId, status, processedRecords, failedRecords, errors });
    });
  });
}

/**
 * Process a single record from CSV
 * Expected columns: sku, name, description, category, price, quantity
 */
async function processRecord(record, lineNumber) {
  // Validate required fields
  if (!record.sku || !record.name) {
    throw new Error('Missing required fields: sku and name');
  }

  const sku = String(record.sku).trim();
  const name = String(record.name).trim();
  const description = record.description || '';
  const category = record.category || 'General';
  const price = parseFloat(record.price) || 0;
  const quantity = parseInt(record.quantity) || 0;

  if (price < 0) {
    throw new Error('Invalid price: must be >= 0');
  }

  if (quantity < 0) {
    throw new Error('Invalid quantity: must be >= 0');
  }

  // Upsert product (Message Translator pattern - CSV to DB model)
  const result = await pool.query(
    `INSERT INTO inventory.products (sku, name, description, category, price, quantity_available, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (sku) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       category = EXCLUDED.category,
       price = EXCLUDED.price,
       quantity_available = EXCLUDED.quantity_available,
       updated_at = NOW()
     RETURNING id, sku`,
    [sku, name, description, category, price, quantity]
  );

  // Record stock movement for new inventory
  if (quantity > 0) {
    await pool.query(
      `INSERT INTO inventory.stock_movements 
       (product_id, movement_type, quantity, reference_type, notes)
       VALUES ($1, 'IN', $2, 'CSV_IMPORT', $3)`,
      [result.rows[0].id, quantity, `Imported from CSV line ${lineNumber}`]
    );
  }

  logger.debug(`Processed product: ${sku}`);
  return result.rows[0];
}

/**
 * Watch inbox folder for new CSV files
 */
function startWatcher() {
  logger.info(`Watching for CSV files in: ${path.resolve(INBOX_PATH)}`);

  const watcher = chokidar.watch(INBOX_PATH, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  watcher.on('add', async (filePath) => {
    if (path.extname(filePath).toLowerCase() === '.csv') {
      logger.info(`New CSV file detected: ${filePath}`);
      
      // Small delay to ensure file is fully written
      setTimeout(async () => {
        try {
          await processCSVFile(filePath);
        } catch (error) {
          logger.error(`Failed to process ${filePath}: ${error.message}`);
          
          // Move to error folder
          try {
            const filename = path.basename(filePath);
            fs.renameSync(filePath, path.join(ERROR_PATH, `${Date.now()}_${filename}`));
          } catch (e) {
            logger.error(`Failed to move file to error folder: ${e.message}`);
          }
        }
      }, 1000);
    }
  });

  watcher.on('error', (error) => {
    logger.error(`Watcher error: ${error.message}`);
  });

  logger.info('File watcher started');
}

/**
 * Process existing files in inbox (on startup)
 */
async function processExistingFiles() {
  try {
    const files = fs.readdirSync(INBOX_PATH);
    const csvFiles = files.filter(f => f.toLowerCase().endsWith('.csv'));
    
    if (csvFiles.length > 0) {
      logger.info(`Found ${csvFiles.length} existing CSV files to process`);
      
      for (const file of csvFiles) {
        try {
          await processCSVFile(path.join(INBOX_PATH, file));
        } catch (error) {
          logger.error(`Failed to process ${file}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    logger.error(`Error processing existing files: ${error.message}`);
  }
}

/**
 * Start the processor
 */
async function start() {
  try {
    await connectDatabase();
    await connectRabbitMQ();
    
    // Process any existing files
    await processExistingFiles();
    
    // Start watching for new files
    startWatcher();
    
    logger.info('Legacy CSV Processor started successfully');
    
  } catch (error) {
    logger.error('Failed to start Legacy Processor:', error);
    process.exit(1);
  }
}

start();
