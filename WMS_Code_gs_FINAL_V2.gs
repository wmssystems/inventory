/************************************************************
 * WMS WEB BASE
 * GOOGLE APPS SCRIPT BACKEND
 * VERSION 1.1
 *
 * FLOW:
 *
 * SUPPLIER
 *    ↓
 * RECEIVING
 *    ↓
 * STG
 *    ↓
 * ┌───────────────┐
 * ↓               ↓
 * WH-L2          WH-INV
 * ↓               ↓
 * └───────┬───────┘
 *         ↓
 *       PROD
 *
 * ISSUE = STOCK MOVE
 * NOT STOCK CONSUMPTION
 *
 ************************************************************/


/* =========================================================
   CONFIG
========================================================= */

const CONFIG = {

  SPREADSHEET_ID: '',

  SHEETS: {

    USERS: 'Users',

    MASTER_PART: 'MasterPart',

    WAREHOUSE: 'Warehouse',

    SUPPLIER: 'Supplier',

    CUSTOMER: 'Customer',

    BOM: 'BOM',

    BOM_DETAIL: 'BOMDetail',

    RECEIVING: 'Receiving',

    TRANSACTION: 'Transaction',

    INVENTORY_BALANCE: 'InventoryBalance',

    PRODUCTION_ORDER: 'ProductionOrder',

    PRODUCTION_CONSUMPTION:
      'ProductionConsumption',

    STOCK_OPNAME:
      'StockOpname',

    STOCK_OPNAME_DETAIL:
      'StockOpnameDetail',

    DELIVERY:
      'Delivery',

    DELIVERY_DETAIL:
      'DeliveryDetail'

  },

  WAREHOUSE_CODES: {

    STAGING: 'STG',

    LANTAI_2: 'WH-L2',

    INVENTORY: 'WH-INV',

    PRODUCTION: 'PROD',

    MATERIAL_NG: 'MAT-NG',

    SUB_ASSY: 'SUB',

    TESTING: 'TEST',

    FINISHED_GOODS: 'FG',

    HOLD_REJECT: 'HOLD'

  }

};


/* =========================================================
   SPREADSHEET
========================================================= */

function getSpreadsheet() {

  if (CONFIG.SPREADSHEET_ID) {

    return SpreadsheetApp.openById(
      CONFIG.SPREADSHEET_ID
    );

  }

  return SpreadsheetApp.getActiveSpreadsheet();

}


/* =========================================================
   ON OPEN
========================================================= */

function onOpen() {

  const ui =
    SpreadsheetApp.getUi();


  ui.createMenu('WMS SYSTEM')

    .addItem(
      'Test System',
      'testSystem'
    )

    .addItem(
      'Rebuild Inventory',
      'rebuildInventory'
    )

    .addItem(
      'Revisi / Hapus Transaction',
      'showDeleteTransaction'
    )

    .addItem(
      'Setup User Admin',
      'setupAdminUser'
    )

    .addItem(
      'Setup Warehouse Final',
      'setupFinalWarehouses'
    )

    .addToUi();


  ui.createMenu('WMS TEST')

    .addItem(
      '1. Test Receiving',
      'testReceiving'
    )

    .addItem(
      '2. Test Transfer',
      'testTransfer'
    )

    .addItem(
      '3. Test Issue',
      'testIssue'
    )

    .addSeparator()

    .addItem(
      '4. Test Sub Assembly',
      'testSubAssembly'
    )

    .addItem(
      '5. Test Finish Product → Testing',
      'testFinishProduct'
    )

    .addItem(
      '6. Test Material NG',
      'testMaterialNG'
    )

    .addItem(
      '7. Test Testing PASS',
      'testTestingPass'
    )

    .addItem(
      '8. Test Testing NG',
      'testTestingNG'
    )

    .addSeparator()

    .addItem(
      '9. Test Delete Transaction',
      'testDeleteTransaction'
    )

    .addSeparator()

    .addItem(
      '10. Cek Inventory Balance',
      'testCheckStock'
    )

    .addItem(
      '11. Cek Transaction',
      'testCheckTransactions'
    )

    .addToUi();

}


/* =========================================================
   TEST SYSTEM
========================================================= */

function testSystem() {

  const ss =
    getSpreadsheet();


  SpreadsheetApp.getUi().alert(

    'WMS SYSTEM',

    'Connection berhasil.\n\n' +
    'Spreadsheet: ' +
    ss.getName(),

    SpreadsheetApp.getUi().ButtonSet.OK

  );

}


/* =========================================================
   GET API
========================================================= */

function doGet(e) {

  try {

    const action =
      e &&
      e.parameter &&
      e.parameter.action
        ? e.parameter.action
        : 'test';


    switch (action) {

      case 'test':

        return jsonResponse({

          success: true,

          message:
            'WMS API aktif',

          timestamp:
            new Date().toISOString()

        });


      case 'login':

        return jsonResponse(

          loginUser({

            username:
              e.parameter.username || '',

            password:
              e.parameter.password || ''

          })

        );


      case 'parts':

        return jsonResponse(
          getParts()
        );


      case 'warehouses':

        return jsonResponse(
          getWarehouses()
        );


      case 'stock':

        return jsonResponse(
          getStock()
        );


      case 'transactions':

        return jsonResponse(

          getTransactions(
            Number(
              e.parameter.limit || 100
            )
          )

        );


      case 'dashboard':

        return jsonResponse(
          getDashboard()
        );


      case 'suppliers':
        return jsonResponse(webGetTable_('suppliers'));

      case 'customers':
        return jsonResponse(webGetTable_('customers'));

      case 'bomHeaders':
        return jsonResponse(webGetTable_('bomHeaders'));

      case 'bomDetails':
        return jsonResponse(webGetTable_('bomDetails'));

      case 'deliveries':
        return jsonResponse(webGetTable_('deliveries'));

      case 'deliveryDetails':
        return jsonResponse(webGetTable_('deliveryDetails'));

      case 'stockOpname':
        return jsonResponse(webGetTable_('stockOpname'));

      case 'stockOpnameDetails':
        return jsonResponse(webGetTable_('stockOpnameDetails'));

      case 'bom':

        return jsonResponse(
          getBOMForPart(
            e.parameter.partId || ''
          )
        );


      default:

        throw new Error(
          'Action GET tidak dikenal: ' +
          action
        );

    }


  } catch (error) {

    return jsonResponse({

      success: false,

      message:
        error.message

    });

  }

}


/* =========================================================
   POST API
========================================================= */

function doPost(e) {
  let data = null;
  let lock = null;
  let requestId = '';

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('POST data tidak ditemukan.');
    }

    data = JSON.parse(e.postData.contents);
    const action = data.action || '';
    requestId = String(data.requestId || '').trim();

    /*
     * IDEMPOTENCY / ANTI DOUBLE INPUT
     * Frontend mengirim requestId unik untuk setiap klik PROCESS.
     * Jika browser mengirim ulang request yang sama karena delay/network,
     * server mengembalikan response yang sama dan TIDAK menulis transaksi kedua.
     */
    if (requestId) {
      const cache = CacheService.getScriptCache();
      const cacheKey = 'WMS_REQ_' + requestId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 180);
      const cached = cache.get(cacheKey);
      if (cached) {
        return ContentService.createTextOutput(cached)
          .setMimeType(ContentService.MimeType.JSON);
      }

      lock = LockService.getScriptLock();
      lock.waitLock(15000);

      const cachedAfterLock = cache.get(cacheKey);
      if (cachedAfterLock) {
        return ContentService.createTextOutput(cachedAfterLock)
          .setMimeType(ContentService.MimeType.JSON);
      }

      data.__cacheKey = cacheKey;
    }

    let result;
    switch (action) {
      case 'receive':
        result = receiveMaterial(data);
        break;
      case 'transfer':
        result = transferStock(data);
        break;
      case 'issue':
        result = issueMaterial(data);
        break;
      case 'deleteTransaction':
        result = deleteTransaction(data);
        break;
      case 'subAssembly':
        result = processSubAssembly(data);
        break;
      case 'finishProduct':
        result = processFinishProduct(data);
        break;
      case 'materialNG':
        result = fastMaterialNG_(data);
        break;
      case 'testingPass':
        result = fastTestingPass_(data);
        break;
      case 'testingNG':
        result = fastTestingNG_(data);
        break;
      case 'saveMaster':
        result = webSaveMaster(data);
        break;
      case 'delivery':
        result = webCreateDelivery(data);
        break;
      case 'stockOpname':
        result = webCreateStockOpname(data);
        break;
      case 'saveBOM':
        result = webSaveBOM(data);
        break;
      default:
        throw new Error('Action POST tidak dikenal: ' + action);
    }

    const responseText = JSON.stringify(result);
    if (requestId && data.__cacheKey) {
      // Cache 10 menit: cukup untuk menangani retry akibat jaringan lambat.
      CacheService.getScriptCache().put(data.__cacheKey, responseText, 600);
    }

    return ContentService.createTextOutput(responseText)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const response = {success:false, message:error.message};
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (ignore) {}
    }
  }
}

/* =========================================================
   LOGIN
========================================================= */

function loginUser(data) {

  const username =
    String(
      data.username || ''
    ).trim();


  const password =
    String(
      data.password || ''
    );


  if (!username) {

    throw new Error(
      'Username wajib diisi.'
    );

  }


  if (!password) {

    throw new Error(
      'Password wajib diisi.'
    );

  }


  const user =
    getUserByUsername(
      username
    );


  if (!user) {

    throw new Error(
      'Username tidak ditemukan.'
    );

  }


  if (

    String(user.Status || '')
      .toUpperCase()

    !==

    'ACTIVE'

  ) {

    throw new Error(
      'User tidak aktif.'
    );

  }


  const storedPassword =
    String(
      user.PasswordHash || ''
    );


  const hashedPassword =
    hashPassword(
      password
    );


  const validPassword =

    storedPassword === password ||

    storedPassword === hashedPassword;


  if (!validPassword) {

    throw new Error(
      'Password salah.'
    );

  }


  return {

    success: true,

    user: {

      UserID:
        user.UserID,

      Username:
        user.Username,

      FullName:
        user.FullName,

      Role:
        user.Role

    }

  };

}


/* =========================================================
   GET USER
========================================================= */

function getUserByUsername(
  username
) {

  const sheet =
    getSheet(
      CONFIG.SHEETS.USERS
    );


  const data =
    getSheetData(sheet);


  if (
    data.rows.length === 0
  ) {

    return null;

  }


  const map =
    getColumnMap(
      data.headers
    );


  const usernameIndex =
    map.username;


  if (
    usernameIndex === undefined
  ) {

    throw new Error(
      'Kolom Username tidak ditemukan di Users.'
    );

  }


  for (
    let i = 0;
    i < data.rows.length;
    i++
  ) {

    const row =
      data.rows[i];


    if (

      String(
        row[usernameIndex] || ''
      )
      .trim()
      .toLowerCase()

      ===

      String(username)
        .trim()
        .toLowerCase()

    ) {

      return rowToObject(
        data.headers,
        row
      );

    }

  }


  return null;

}


/* =========================================================
   GET PARTS
========================================================= */

function getParts() {

  const sheet =
    getSheet(
      CONFIG.SHEETS.MASTER_PART
    );


  const data =
    getSheetData(sheet);


  const result = [];


  data.rows.forEach(row => {

    const obj =
      rowToObject(
        data.headers,
        row
      );


    if (

      !obj.Status ||

      String(obj.Status)
        .toUpperCase()
      ===
      'ACTIVE'

    ) {

      result.push(obj);

    }

  });


  return {

    success: true,

    data: result

  };

}


/* =========================================================
   GET WAREHOUSES
========================================================= */

function getWarehouses() {

  const sheet =
    getSheet(
      CONFIG.SHEETS.WAREHOUSE
    );


  const data =
    getSheetData(sheet);


  const result = [];


  data.rows.forEach(row => {

    const obj =
      rowToObject(
        data.headers,
        row
      );


    if (

      !obj.Status ||

      String(obj.Status)
        .toUpperCase()
      ===
      'ACTIVE'

    ) {

      result.push(obj);

    }

  });


  return {

    success: true,

    data: result

  };

}


/* =========================================================
   GET STOCK
========================================================= */

function getStock() {

  const sheet =
    getSheet(
      CONFIG.SHEETS.INVENTORY_BALANCE
    );


  const data =
    getSheetData(sheet);


  const result = [];


  data.rows.forEach(row => {

    const obj =
      rowToObject(
        data.headers,
        row
      );


    if (
      obj.PartID ||
      obj.WarehouseID
    ) {

      result.push(obj);

    }

  });


  return {

    success: true,

    data: result,

    count:
      result.length

  };

}


/* =========================================================
   GET TRANSACTIONS
========================================================= */

function getTransactions(
  limit
) {

  const sheet =
    getSheet(
      CONFIG.SHEETS.TRANSACTION
    );


  const data =
    getSheetData(sheet);


  const result = [];


  const max =
    Math.max(
      1,
      Number(limit || 100)
    );


  for (

    let i =
      data.rows.length - 1;

    i >= 0 &&
    result.length < max;

    i--

  ) {

    result.push(

      rowToObject(
        data.headers,
        data.rows[i]
      )

    );

  }


  return {

    success: true,

    data: result,

    count:
      result.length

  };

}


/* =========================================================
   DASHBOARD
========================================================= */

function getDashboard() {

  const stock =
    getStock().data;


  const transactions =
    getTransactions(
      1000
    ).data;


  let totalStock = 0;


  stock.forEach(item => {

    totalStock +=
      Number(
        item.QtyOnHand || 0
      );

  });


  const today =
    Utilities.formatDate(

      new Date(),

      Session.getScriptTimeZone(),

      'yyyy-MM-dd'

    );


  let todayTransactions = 0;


  transactions.forEach(tx => {

    if (!tx.TransactionDate) {
      return;
    }


    const txDate =
      Utilities.formatDate(

        new Date(
          tx.TransactionDate
        ),

        Session.getScriptTimeZone(),

        'yyyy-MM-dd'

      );


    if (
      txDate === today
    ) {

      todayTransactions++;

    }

  });


  return {

    success: true,

    data: {

      totalStock:
        totalStock,

      balanceLines:
        stock.length,

      totalTransactions:
        transactions.length,

      todayTransactions:
        todayTransactions

    }

  };

}



/* =========================================================
   FAST TRANSACTION ENGINE
   - One InventoryBalance read per stock movement
   - One write per existing balance row (full row setValues)
   - Avoid repeated getDataRange() calls
   - Script lock prevents concurrent stock race
========================================================= */

function fastReceiveMaterial_(data) {
  const d = normalizeInput(data);
  validateRequired(d, ['partId','qty','batchNo']);

  const partId = String(d.partId).trim();
  const qty = Number(d.qty);
  const batchNo = String(d.batchNo).trim();
  const uom = d.uom || 'PCS';
  const username = d.username || 'admin';
  if (qty <= 0) throw new Error('Quantity harus lebih besar dari 0.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Sistem sedang memproses transaksi lain. Silakan scan kembali.');
  try {
    validatePart(partId);
    const staging = findWarehouseByCode(CONFIG.WAREHOUSE_CODES.STAGING);
    if (!staging) throw new Error('Warehouse STG tidak ditemukan.');

    const now = new Date();
    const balanceSheet = getSheet(CONFIG.SHEETS.INVENTORY_BALANCE);
    const ds = getSheetData(balanceSheet);
    const map = getColumnMap(ds.headers);
    const match = findBalanceRow_(ds, map, partId, staging.WarehouseID, batchNo);
    const newQty = (match ? match.currentQty : 0) + qty;
    const reserved = match ? match.reservedQty : 0;
    if (newQty < 0) throw new Error('Stock tidak boleh minus.');
    const row = match ? ds.rows[match.index] : null;
    const values = match ? row.slice() : ds.headers.map(() => '');
    if (!match) {
      setByMap_(values, map, 'balanceid', generateId('BAL'));
      setByMap_(values, map, 'partid', partId);
      setByMap_(values, map, 'warehouseid', staging.WarehouseID);
      setByMap_(values, map, 'batchno', batchNo);
    }
    setByMap_(values, map, 'qtyonhand', newQty);
    setByMap_(values, map, 'qtyreserved', reserved);
    setByMap_(values, map, 'qtyavailable', newQty - reserved);
    setByMap_(values, map, 'lasttransactionat', now);
    setByMap_(values, map, 'updatedat', now);
    writeBalanceRow_(balanceSheet, values, match ? match.rowNumber : null);

    const receivingId = generateId('RCV');
    const receivingNo = generateNumber('RCV');
    const transactionId = generateId('TXN');
    const transactionNo = generateNumber('TXN');
    appendObjectFast_(getSheet(CONFIG.SHEETS.RECEIVING), {
      ReceivingID: receivingId, ReceivingNo: receivingNo, ReceivingDate: now,
      SupplierID: d.supplierId || '', PartID: partId, Qty: qty, UOM: uom,
      BatchNo: batchNo, ReferenceNo: d.referenceNo || '', Status: 'COMPLETED',
      CreatedBy: username, CreatedAt: now
    });
    appendObjectFast_(getSheet(CONFIG.SHEETS.TRANSACTION), {
      TransactionID: transactionId, TransactionNo: transactionNo, TransactionDate: now,
      TransactionType: 'RECEIVE', ReferenceNo: d.referenceNo || receivingNo,
      PartID: partId, FromWarehouseID: '', ToWarehouseID: staging.WarehouseID,
      Qty: qty, UOM: uom, BatchNo: batchNo, Status: 'COMPLETED',
      CreatedBy: username, CreatedAt: now, Remarks: d.remarks || ''
    });
    return {success:true,message:'Receiving berhasil.',data:{receivingId,receivingNo,transactionId,transactionNo,partId,warehouse:staging.WarehouseCode,qty,batchNo}};
  } finally { lock.releaseLock(); }
}

function fastTransferStock_(data) {
  const d = normalizeInput(data);
  validateRequired(d, ['partId','fromWarehouseId','toWarehouseId','qty','batchNo']);
  return fastMoveStock_(d, 'TRANSFER');
}

function fastIssueMaterial_(data) {
  const d = normalizeInput(data);
  validateRequired(d, ['partId','fromWarehouseId','qty','batchNo']);
  const production = findWarehouseByCode(CONFIG.WAREHOUSE_CODES.PRODUCTION);
  if (!production) throw new Error('Warehouse PROD tidak ditemukan.');
  d.toWarehouseId = production.WarehouseID;
  const result = fastMoveStock_(d, 'ISSUE');
  result.message = 'Issue berhasil. Material dipindahkan ke Production.';
  return result;
}

function fastMoveStock_(data, transactionType) {
  const d = normalizeInput(data);
  const partId = String(d.partId).trim();
  const fromWarehouseId = String(d.fromWarehouseId).trim();
  const toWarehouseId = String(d.toWarehouseId).trim();
  const qty = Number(d.qty);
  const batchNo = String(d.batchNo).trim();
  const uom = d.uom || 'PCS';
  const username = d.username || 'admin';
  if (qty <= 0) throw new Error('Quantity harus lebih besar dari 0.');
  if (fromWarehouseId === toWarehouseId) throw new Error('Warehouse asal dan tujuan tidak boleh sama.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Sistem sedang memproses transaksi lain. Silakan scan kembali.');
  try {
    validatePart(partId);
    const fromWarehouse = findWarehouseById(fromWarehouseId);
    const toWarehouse = findWarehouseById(toWarehouseId);
    if (!fromWarehouse) throw new Error('Warehouse asal tidak ditemukan.');
    if (!toWarehouse) throw new Error('Warehouse tujuan tidak ditemukan.');

    const sheet = getSheet(CONFIG.SHEETS.INVENTORY_BALANCE);
    const ds = getSheetData(sheet); // SINGLE inventory read
    const map = getColumnMap(ds.headers);
    const source = findBalanceRow_(ds, map, partId, fromWarehouseId, batchNo);
    const destination = findBalanceRow_(ds, map, partId, toWarehouseId, batchNo);
    const available = source ? source.currentQty : 0;
    if (available < qty) {
      throw new Error('Stock tidak cukup.\n\nPart: '+partId+'\nWarehouse: '+fromWarehouse.WarehouseCode+'\nBatch: '+batchNo+'\nStock tersedia: '+available+'\nQty request: '+qty);
    }

    const now = new Date();
    const sourceValues = ds.rows[source.index].slice();
    const sourceNew = source.currentQty - qty;
    setByMap_(sourceValues, map, 'qtyonhand', sourceNew);
    setByMap_(sourceValues, map, 'qtyavailable', sourceNew - source.reservedQty);
    setByMap_(sourceValues, map, 'lasttransactionat', now);
    setByMap_(sourceValues, map, 'updatedat', now);

    let destValues, destRowNumber = null;
    if (destination) {
      destValues = ds.rows[destination.index].slice();
      const destNew = destination.currentQty + qty;
      setByMap_(destValues, map, 'qtyonhand', destNew);
      setByMap_(destValues, map, 'qtyavailable', destNew - destination.reservedQty);
      setByMap_(destValues, map, 'lasttransactionat', now);
      setByMap_(destValues, map, 'updatedat', now);
      destRowNumber = destination.rowNumber;
    } else {
      destValues = ds.headers.map(() => '');
      setByMap_(destValues, map, 'balanceid', generateId('BAL'));
      setByMap_(destValues, map, 'partid', partId);
      setByMap_(destValues, map, 'warehouseid', toWarehouseId);
      setByMap_(destValues, map, 'batchno', batchNo);
      setByMap_(destValues, map, 'qtyonhand', qty);
      setByMap_(destValues, map, 'qtyreserved', 0);
      setByMap_(destValues, map, 'qtyavailable', qty);
      setByMap_(destValues, map, 'lasttransactionat', now);
      setByMap_(destValues, map, 'updatedat', now);
    }

    // Two direct row writes instead of many setValue() calls.
    writeBalanceRow_(sheet, sourceValues, source.rowNumber);
    writeBalanceRow_(sheet, destValues, destRowNumber);

    const transactionId = generateId('TXN');
    const transactionNo = generateNumber('TXN');
    appendObjectFast_(getSheet(CONFIG.SHEETS.TRANSACTION), {
      TransactionID: transactionId, TransactionNo: transactionNo, TransactionDate: now,
      TransactionType: transactionType, ReferenceNo: d.referenceNo || transactionNo,
      PartID: partId, FromWarehouseID: fromWarehouseId, ToWarehouseID: toWarehouseId,
      Qty: qty, UOM: uom, BatchNo: batchNo, Status: 'COMPLETED',
      CreatedBy: username, CreatedAt: now, Remarks: d.remarks || ''
    });
    return {success:true,message:transactionType+' berhasil.',data:{transactionId,transactionNo,transactionType,partId,fromWarehouse:fromWarehouse.WarehouseCode,toWarehouse:toWarehouse.WarehouseCode,qty,batchNo}};
  } finally { lock.releaseLock(); }
}

function findBalanceRow_(ds, map, partId, warehouseId, batchNo) {
  for (let i=0;i<ds.rows.length;i++) {
    const row=ds.rows[i];
    if (String(row[map.partid]||'').trim()===String(partId).trim() &&
        String(row[map.warehouseid]||'').trim()===String(warehouseId).trim() &&
        String(row[map.batchno]||'').trim()===String(batchNo||'').trim()) {
      return {index:i,rowNumber:i+2,currentQty:Number(row[map.qtyonhand]||0),reservedQty:Number(row[map.qtyreserved]||0)};
    }
  }
  return null;
}

function setByMap_(row, map, key, value) {
  if (map[key] !== undefined) row[map[key]] = value;
}

function writeBalanceRow_(sheet, row, rowNumber) {
  if (rowNumber) {
    sheet.getRange(rowNumber,1,1,row.length).setValues([row]);
  } else {
    sheet.getRange(sheet.getLastRow()+1,1,1,row.length).setValues([row]);
  }
}

function appendObjectFast_(sheet, object) {
  const lastColumn=sheet.getLastColumn();
  if(lastColumn<1) throw new Error('Sheet tidak mempunyai header: '+sheet.getName());
  const headers=sheet.getRange(1,1,1,lastColumn).getValues()[0];
  const normalized={};
  Object.keys(object).forEach(k=>normalized[normalizeKey(k)]=object[k]);
  const row=headers.map(h=>Object.prototype.hasOwnProperty.call(normalized,normalizeKey(h))?normalized[normalizeKey(h)]:'');
  sheet.getRange(sheet.getLastRow()+1,1,1,row.length).setValues([row]);
}


function fastMaterialNG_(data) {
  const d=normalizeInput(data); validateRequired(d,['partId','qty','batchNo']);
  const prod=findWarehouseByCode(CONFIG.WAREHOUSE_CODES.PRODUCTION);
  const ng=findWarehouseByCode(CONFIG.WAREHOUSE_CODES.MATERIAL_NG);
  if(!prod) throw new Error('Warehouse PROD tidak ditemukan.');
  if(!ng) throw new Error('Warehouse MAT-NG tidak ditemukan. Jalankan Setup Warehouse Final.');
  d.fromWarehouseId=prod.WarehouseID; d.toWarehouseId=ng.WarehouseID;
  const r=fastMoveStock_(d,'MATERIAL_NG');
  r.message='Material NG berhasil dipindahkan ke MAT-NG.'; return r;
}

function fastTestingPass_(data) {
  const d=normalizeInput(data); validateRequired(d,['partId','qty','batchNo']);
  const test=findWarehouseByCode(CONFIG.WAREHOUSE_CODES.TESTING);
  const fg=findWarehouseByCode(CONFIG.WAREHOUSE_CODES.FINISHED_GOODS);
  if(!test) throw new Error('Warehouse TEST tidak ditemukan.');
  if(!fg) throw new Error('Warehouse FG tidak ditemukan.');
  d.fromWarehouseId=test.WarehouseID; d.toWarehouseId=fg.WarehouseID;
  const r=fastMoveStock_(d,'TEST_PASS');
  r.message='Testing PASS berhasil. Produk masuk FG.'; return r;
}

function fastTestingNG_(data) {
  const d=normalizeInput(data); validateRequired(d,['partId','qty','batchNo']);
  const test=findWarehouseByCode(CONFIG.WAREHOUSE_CODES.TESTING);
  const hold=findWarehouseByCode(CONFIG.WAREHOUSE_CODES.HOLD_REJECT);
  if(!test) throw new Error('Warehouse TEST tidak ditemukan.');
  if(!hold) throw new Error('Warehouse HOLD tidak ditemukan. Jalankan Setup Warehouse Final.');
  d.fromWarehouseId=test.WarehouseID; d.toWarehouseId=hold.WarehouseID;
  const r=fastMoveStock_(d,'TEST_NG');
  r.message='Testing NG berhasil. Produk masuk HOLD.'; return r;
}

/* =========================================================
   RECEIVING
   SUPPLIER -> STG
========================================================= */

function receiveMaterial(
  data
) {

  const d =
    normalizeInput(data);


  validateRequired(

    d,

    [
      'partId',
      'qty',
      'batchNo'
    ]

  );


  const partId =
    String(
      d.partId
    ).trim();


  const qty =
    Number(d.qty);


  const batchNo =
    String(
      d.batchNo
    ).trim();


  const uom =
    d.uom || 'PCS';


  const username =
    d.username || 'admin';


  if (
    qty <= 0
  ) {

    throw new Error(
      'Quantity harus lebih besar dari 0.'
    );

  }


  validatePart(
    partId
  );


  const staging =
    findWarehouseByCode(
      CONFIG.WAREHOUSE_CODES.STAGING
    );


  if (!staging) {

    throw new Error(
      'Warehouse STG tidak ditemukan.'
    );

  }


  const now =
    new Date();


  const receivingId =
    generateId('RCV');


  const receivingNo =
    generateNumber('RCV');


  const transactionId =
    generateId('TXN');


  const transactionNo =
    generateNumber('TXN');


  /* Receiving */

  appendObject(

    getSheet(
      CONFIG.SHEETS.RECEIVING
    ),

    {

      ReceivingID:
        receivingId,

      ReceivingNo:
        receivingNo,

      ReceivingDate:
        now,

      SupplierID:
        d.supplierId || '',

      PartID:
        partId,

      Qty:
        qty,

      UOM:
        uom,

      BatchNo:
        batchNo,

      ReferenceNo:
        d.referenceNo || '',

      Status:
        'COMPLETED',

      CreatedBy:
        username,

      CreatedAt:
        now

    }

  );


  /* Inventory STG + */

  updateBalance({

    partId:
      partId,

    warehouseId:
      staging.WarehouseID,

    batchNo:
      batchNo,

    delta:
      qty,

    uom:
      uom,

    transactionDate:
      now

  });


  /* Transaction */

  appendObject(

    getSheet(
      CONFIG.SHEETS.TRANSACTION
    ),

    {

      TransactionID:
        transactionId,

      TransactionNo:
        transactionNo,

      TransactionDate:
        now,

      TransactionType:
        'RECEIVE',

      ReferenceNo:
        d.referenceNo ||
        receivingNo,

      PartID:
        partId,

      FromWarehouseID:
        '',

      ToWarehouseID:
        staging.WarehouseID,

      Qty:
        qty,

      UOM:
        uom,

      BatchNo:
        batchNo,

      Status:
        'COMPLETED',

      CreatedBy:
        username,

      CreatedAt:
        now,

      Remarks:
        d.remarks || ''

    }

  );


  return {

    success: true,

    message:
      'Receiving berhasil.',

    data: {

      receivingId:
        receivingId,

      receivingNo:
        receivingNo,

      transactionId:
        transactionId,

      transactionNo:
        transactionNo,

      partId:
        partId,

      warehouse:
        staging.WarehouseCode,

      qty:
        qty,

      batchNo:
        batchNo

    }

  };

}


/* =========================================================
   TRANSFER
   STG / WH-L2 / WH-INV
========================================================= */

function transferStock(
  data
) {

  const d =
    normalizeInput(data);


  validateRequired(

    d,

    [
      'partId',
      'fromWarehouseId',
      'toWarehouseId',
      'qty',
      'batchNo'
    ]

  );


  return moveStockWithTransactionType(

    d,

    'TRANSFER'

  );

}


/* =========================================================
   ISSUE
   WAREHOUSE -> PROD
========================================================= */

function issueMaterial(
  data
) {

  const d =
    normalizeInput(data);


  validateRequired(

    d,

    [
      'partId',
      'fromWarehouseId',
      'qty',
      'batchNo'
    ]

  );


  const production =
    findWarehouseByCode(
      CONFIG.WAREHOUSE_CODES.PRODUCTION
    );


  if (!production) {

    throw new Error(
      'Warehouse PROD tidak ditemukan.'
    );

  }


  /*
   * ISSUE SELALU MASUK KE PROD
   */

  d.toWarehouseId =
    production.WarehouseID;


  const result =
    moveStockWithTransactionType(

      d,

      'ISSUE'

    );


  return {

    success: true,

    message:
      'Issue berhasil. Material dipindahkan ke Production.',

    data:
      result.data

  };

}


/* =========================================================
   MOVE STOCK ENGINE
========================================================= */

function moveStockWithTransactionType(

  data,

  transactionType

) {

  const d =
    normalizeInput(data);


  validateRequired(

    d,

    [
      'partId',
      'fromWarehouseId',
      'toWarehouseId',
      'qty',
      'batchNo'
    ]

  );


  const partId =
    String(
      d.partId
    ).trim();


  const fromWarehouseId =
    String(
      d.fromWarehouseId
    ).trim();


  const toWarehouseId =
    String(
      d.toWarehouseId
    ).trim();


  const qty =
    Number(d.qty);


  const batchNo =
    String(
      d.batchNo
    ).trim();


  const uom =
    d.uom || 'PCS';


  const username =
    d.username || 'admin';


  if (
    qty <= 0
  ) {

    throw new Error(
      'Quantity harus lebih besar dari 0.'
    );

  }


  if (
    fromWarehouseId ===
    toWarehouseId
  ) {

    throw new Error(
      'Warehouse asal dan tujuan tidak boleh sama.'
    );

  }


  validatePart(
    partId
  );


  const fromWarehouse =
    findWarehouseById(
      fromWarehouseId
    );


  const toWarehouse =
    findWarehouseById(
      toWarehouseId
    );


  if (!fromWarehouse) {

    throw new Error(
      'Warehouse asal tidak ditemukan.'
    );

  }


  if (!toWarehouse) {

    throw new Error(
      'Warehouse tujuan tidak ditemukan.'
    );

  }


  /*
   * CEK STOCK SOURCE
   */

  const available =
    getBalanceQty({

      partId:
        partId,

      warehouseId:
        fromWarehouseId,

      batchNo:
        batchNo

    });


  if (
    available < qty
  ) {

    throw new Error(

      'Stock tidak cukup.\n\n' +

      'Part: ' +
      partId +

      '\nWarehouse: ' +
      fromWarehouse.WarehouseCode +

      '\nBatch: ' +
      batchNo +

      '\nStock tersedia: ' +
      available +

      '\nQty request: ' +
      qty

    );

  }


  const now =
    new Date();


  const transactionId =
    generateId('TXN');


  const transactionNo =
    generateNumber('TXN');


  /*
   * SOURCE -
   */

  updateBalance({

    partId:
      partId,

    warehouseId:
      fromWarehouseId,

    batchNo:
      batchNo,

    delta:
      -qty,

    uom:
      uom,

    transactionDate:
      now

  });


  /*
   * DESTINATION +
   */

  try {

    updateBalance({

      partId:
        partId,

      warehouseId:
        toWarehouseId,

      batchNo:
        batchNo,

      delta:
        qty,

      uom:
        uom,

      transactionDate:
        now

    });


  } catch (error) {

    /*
     * ROLLBACK SOURCE
     */

    updateBalance({

      partId:
        partId,

      warehouseId:
        fromWarehouseId,

      batchNo:
        batchNo,

      delta:
        qty,

      uom:
        uom,

      transactionDate:
        now

    });


    throw error;

  }


  /*
   * CREATE TRANSACTION
   */

  appendObject(

    getSheet(
      CONFIG.SHEETS.TRANSACTION
    ),

    {

      TransactionID:
        transactionId,

      TransactionNo:
        transactionNo,

      TransactionDate:
        now,

      TransactionType:
        transactionType,

      ReferenceNo:
        d.referenceNo ||
        transactionNo,

      PartID:
        partId,

      FromWarehouseID:
        fromWarehouseId,

      ToWarehouseID:
        toWarehouseId,

      Qty:
        qty,

      UOM:
        uom,

      BatchNo:
        batchNo,

      Status:
        'COMPLETED',

      CreatedBy:
        username,

      CreatedAt:
        now,

      Remarks:
        d.remarks || ''

    }

  );


  return {

    success: true,

    message:
      transactionType +
      ' berhasil.',

    data: {

      transactionId:
        transactionId,

      transactionNo:
        transactionNo,

      transactionType:
        transactionType,

      partId:
        partId,

      fromWarehouse:
        fromWarehouse.WarehouseCode,

      toWarehouse:
        toWarehouse.WarehouseCode,

      qty:
        qty,

      batchNo:
        batchNo

    }

  };

}


/* =========================================================
   DATE ONLY HELPER

   Normalisasi tanggal menjadi yyyy-MM-dd berdasarkan
   timezone Spreadsheet/Apps Script. Dipakai untuk
   EffectiveDate BOM agar tanggal hari ini valid tanpa
   masalah perbandingan timestamp/timezone.
========================================================= */

function getDateOnlyKey(value) {

  if (value === null || value === undefined || value === '') {
    return '';
  }

  const timeZone = Session.getScriptTimeZone() || 'Asia/Jakarta';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
  }

  const text = String(value).trim();

  if (!text) return '';

  // Format sheet yang paling aman: yyyy-MM-dd
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[1] + '-' + isoMatch[2] + '-' + isoMatch[3];
  }

  const parsed = new Date(text);

  if (isNaN(parsed.getTime())) return '';

  return Utilities.formatDate(parsed, timeZone, 'yyyy-MM-dd');
}


/* =========================================================
   BOM LOOKUP
========================================================= */

function getBOMForPart(
  parentPartId
) {

  const partId =
    String(parentPartId || '').trim();

  if (!partId) {
    throw new Error('Parent PartID wajib diisi.');
  }

  validatePart(partId);

  const bomSheet =
    getSheet(CONFIG.SHEETS.BOM);

  const detailSheet =
    getSheet(CONFIG.SHEETS.BOM_DETAIL);

  const bomData =
    getSheetData(bomSheet);

  const detailData =
    getSheetData(detailSheet);

  /*
     EffectiveDate dibandingkan berdasarkan TANGGAL saja,
     bukan timestamp. Dengan demikian BOM dengan
     EffectiveDate = hari ini langsung dianggap efektif,
     tanpa terpengaruh jam/timezone Apps Script.
  */
  const todayKey = getDateOnlyKey(new Date());
  let selectedBOM = null;

  bomData.rows.forEach(row => {

    const obj = rowToObject(
      bomData.headers,
      row
    );

    const rowParent =
      String(obj.ParentPartID || '').trim();

    const status =
      String(obj.Status || '').trim().toUpperCase();

    if (rowParent !== partId) return;
    if (status && status !== 'ACTIVE') return;

    const effectiveDateKey =
      getDateOnlyKey(obj.EffectiveDate);

    if (!effectiveDateKey) return;
    if (effectiveDateKey > todayKey) return;

    if (
      !selectedBOM ||
      effectiveDateKey > selectedBOM._effectiveDateKey
    ) {
      selectedBOM = {
        data: obj,
        _effectiveDateKey: effectiveDateKey
      };
    }
  });

  if (!selectedBOM) {
    throw new Error(
      'BOM ACTIVE tidak ditemukan untuk Parent PartID: ' +
      partId
    );
  }

  const bom = selectedBOM.data;
  const bomId = String(bom.BOMID || '').trim();

  if (!bomId) {
    throw new Error('BOMID kosong pada BOM aktif: ' + partId);
  }

  const details = [];

  detailData.rows.forEach(row => {

    const obj = rowToObject(
      detailData.headers,
      row
    );

    if (
      String(obj.BOMID || '').trim() !== bomId
    ) return;

    const status =
      String(obj.Status || '').trim().toUpperCase();

    if (status && status !== 'ACTIVE') return;

    const componentPartId =
      String(obj.ComponentPartID || '').trim();

    const qtyPer = Number(obj.QtyPer || 0);

    const scrapPercent = Number(
      obj.ScrapPercent || 0
    );

    if (!componentPartId) {
      throw new Error(
        'ComponentPartID kosong pada BOMID: ' + bomId
      );
    }

    if (qtyPer <= 0) {
      throw new Error(
        'QtyPer harus > 0 untuk component: ' +
        componentPartId
      );
    }

    validatePart(componentPartId);

    details.push({
      BOMDetailID: obj.BOMDetailID || '',
      ComponentPartID: componentPartId,
      QtyPer: qtyPer,
      UOM: obj.UOM || 'PCS',
      ScrapPercent: scrapPercent
    });
  });

  if (details.length === 0) {
    throw new Error(
      'BOMDetail tidak ditemukan untuk BOMID: ' + bomId
    );
  }

  return {
    success: true,
    data: {
      bom: bom,
      details: details
    }
  };
}


/* =========================================================
   PRODUCTION - SUB ASSEMBLY

   PROD -> CONSUME MATERIAL
   SUB  -> OUTPUT SUB ASSEMBLY

   Tidak menggunakan Production Order.
========================================================= */

function createSubAssembly(
  data
) {

  const d = normalizeInput(data);

  validateRequired(
    d,
    [
      'parentPartId',
      'qty',
      'outputBatchNo'
    ]
  );

  return createProductionOutput({
    data: d,
    outputWarehouseCode:
      CONFIG.WAREHOUSE_CODES.SUB_ASSY,
    outputTransactionType:
      'PRODUCTION_OUTPUT',
    processName:
      'SUB ASSEMBLY'
  });
}


/* =========================================================
   PRODUCTION - FINISH PRODUCT

   SUB -> CONSUME SUB ASSEMBLY
   FG  -> OUTPUT FINISHED PRODUCT

   Tidak menggunakan Production Order.
========================================================= */

function createFinishProduct(
  data
) {

  const d = normalizeInput(data);

  validateRequired(
    d,
    [
      'parentPartId',
      'qty',
      'outputBatchNo'
    ]
  );

  return createProductionOutput({
    data: d,
    outputWarehouseCode:
      CONFIG.WAREHOUSE_CODES.TESTING,
    outputTransactionType:
      'FINISH_OUTPUT',
    processName:
      'FINISH PRODUCT'
  });
}


/* =========================================================
   PRODUCTION ENGINE

   1. Baca BOM
   2. Hitung kebutuhan semua component
   3. Cek total stock source
   4. Buat rencana batch consumption
   5. Kurangi source stock
   6. Tambah output stock
   7. Tulis Transaction

   Jika gagal, stock yang sudah berubah di-rollback.
========================================================= */

function createProductionOutput(
  options
) {

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {

    const d = options.data;

    const parentPartId =
      String(d.parentPartId || '').trim();

    const qtyOutput =
      Number(d.qty);

    const outputBatchNo =
      String(d.outputBatchNo || '').trim();

    const username =
      String(d.username || 'admin').trim();

    if (qtyOutput <= 0) {
      throw new Error(
        'Quantity produksi harus lebih besar dari 0.'
      );
    }

    validatePart(parentPartId);

    const outputWarehouse =
      findWarehouseByCode(
        options.outputWarehouseCode
      );

    if (!outputWarehouse) {
      throw new Error(
        'Warehouse output tidak ditemukan: ' +
        options.outputWarehouseCode
      );
    }

    const bomResult =
      getBOMForPart(parentPartId);

    const components =
      bomResult.data.details;

    const sourceWarehouseCode =
      options.outputTransactionType === 'FINISH_OUTPUT'
        ? CONFIG.WAREHOUSE_CODES.SUB_ASSY
        : CONFIG.WAREHOUSE_CODES.PRODUCTION;

    const sourceWarehouse =
      findWarehouseByCode(sourceWarehouseCode);

    if (!sourceWarehouse) {
      throw new Error(
        'Warehouse source tidak ditemukan: ' +
        sourceWarehouseCode
      );
    }

    /* -------------------------------------------------------
       HITUNG KEBUTUHAN
    ------------------------------------------------------- */

    const requirements = components.map(component => {

      const baseQty =
        qtyOutput * Number(component.QtyPer || 0);

      const scrapMultiplier =
        1 + (Number(component.ScrapPercent || 0) / 100);

      const requiredQty =
        roundQuantity(baseQty * scrapMultiplier);

      return {
        partId:
          component.ComponentPartID,
        requiredQty:
          requiredQty,
        uom:
          component.UOM || 'PCS'
      };
    });

    /* -------------------------------------------------------
       CEK DAN RENCANA BATCH

       Sistem dapat menggunakan lebih dari satu batch.
       Tidak ada FIFO khusus; batch dipakai berdasarkan
       urutan baris InventoryBalance.
    ------------------------------------------------------- */

    const consumptionPlan = [];

    requirements.forEach(requirement => {

      const batches =
        getAvailableBatches(
          requirement.partId,
          sourceWarehouse.WarehouseID
        );

      let remaining =
        requirement.requiredQty;

      batches.forEach(batch => {

        if (remaining <= 0) return;

        const take =
          Math.min(
            remaining,
            Number(batch.qty || 0)
          );

        if (take <= 0) return;

        consumptionPlan.push({
          partId:
            requirement.partId,
          warehouseId:
            sourceWarehouse.WarehouseID,
          warehouseCode:
            sourceWarehouse.WarehouseCode,
          batchNo:
            batch.batchNo,
          qty:
            roundQuantity(take),
          uom:
            requirement.uom
        });

        remaining =
          roundQuantity(remaining - take);
      });

      if (remaining > 0) {
        throw new Error(
          'Stock tidak cukup untuk produksi.\n\n' +
          'Part: ' + requirement.partId + '\n' +
          'Warehouse: ' + sourceWarehouse.WarehouseCode + '\n' +
          'Kebutuhan: ' + requirement.requiredQty + '\n' +
          'Stock tersedia: ' +
          roundQuantity(
            batches.reduce(
              (sum, item) => sum + Number(item.qty || 0),
              0
            )
          )
        );
      }
    });

    /* -------------------------------------------------------
       REFERENCE PROCESS
    ------------------------------------------------------- */

    const processPrefix =
      options.outputTransactionType === 'FINISH_OUTPUT'
        ? 'FG'
        : 'SA';

    const processNo =
      d.referenceNo ||
      generateNumber(processPrefix + '-PROD');

    const now = new Date();

    const transactionObjects = [];

    /* -------------------------------------------------------
       CONSUMPTION TRANSACTIONS
    ------------------------------------------------------- */

    consumptionPlan.forEach(item => {

      transactionObjects.push({
        TransactionID:
          generateId('TXN'),
        TransactionNo:
          generateNumber('TXN'),
        TransactionDate:
          now,
        TransactionType:
          'CONSUME',
        ReferenceNo:
          processNo,
        PartID:
          item.partId,
        FromWarehouseID:
          item.warehouseId,
        ToWarehouseID:
          '',
        Qty:
          item.qty,
        UOM:
          item.uom,
        BatchNo:
          item.batchNo,
        Status:
          'COMPLETED',
        CreatedBy:
          username,
        CreatedAt:
          now,
        Remarks:
          (d.remarks || '') +
          ' | ' +
          options.processName +
          ' consumption'
      });
    });

    /* -------------------------------------------------------
       OUTPUT TRANSACTION
    ------------------------------------------------------- */

    transactionObjects.push({
      TransactionID:
        generateId('TXN'),
      TransactionNo:
        generateNumber('TXN'),
      TransactionDate:
        now,
      TransactionType:
        options.outputTransactionType,
      ReferenceNo:
        processNo,
      PartID:
        parentPartId,
      FromWarehouseID:
        '',
      ToWarehouseID:
        outputWarehouse.WarehouseID,
      Qty:
        qtyOutput,
      UOM:
        d.uom || 'PCS',
      BatchNo:
        outputBatchNo,
      Status:
        'COMPLETED',
      CreatedBy:
        username,
      CreatedAt:
        now,
      Remarks:
        (d.remarks || '') +
        ' | ' +
        options.processName +
        ' output'
    });

    /* -------------------------------------------------------
       UPDATE STOCK + ROLLBACK PROTECTION
    ------------------------------------------------------- */

    const changedBalances = [];

    try {

      consumptionPlan.forEach(item => {

        updateBalance({
          partId:
            item.partId,
          warehouseId:
            item.warehouseId,
          batchNo:
            item.batchNo,
          delta:
            -item.qty,
          uom:
            item.uom,
          transactionDate:
            now
        });

        changedBalances.push({
          partId:
            item.partId,
          warehouseId:
            item.warehouseId,
          batchNo:
            item.batchNo,
          delta:
            item.qty,
          uom:
            item.uom
        });
      });

      updateBalance({
        partId:
          parentPartId,
        warehouseId:
          outputWarehouse.WarehouseID,
        batchNo:
          outputBatchNo,
        delta:
          qtyOutput,
        uom:
          d.uom || 'PCS',
        transactionDate:
          now
      });

      changedBalances.push({
        partId:
          parentPartId,
        warehouseId:
          outputWarehouse.WarehouseID,
        batchNo:
          outputBatchNo,
        delta:
          -qtyOutput,
        uom:
          d.uom || 'PCS'
      });

      /* -----------------------------------------------------
         TULIS SEMUA TRANSACTION SEKALIGUS
      ----------------------------------------------------- */

      appendObjectsBatch(
        getSheet(CONFIG.SHEETS.TRANSACTION),
        transactionObjects
      );

    } catch (error) {

      /* -----------------------------------------------------
         ROLLBACK STOCK
      ----------------------------------------------------- */

      for (
        let i = changedBalances.length - 1;
        i >= 0;
        i--
      ) {

        const item = changedBalances[i];

        try {
          updateBalance({
            partId:
              item.partId,
            warehouseId:
              item.warehouseId,
            batchNo:
              item.batchNo,
            delta:
              item.delta,
            uom:
              item.uom,
            transactionDate:
              now
          });
        } catch (rollbackError) {
          console.error(
            'ROLLBACK ERROR: ' +
            rollbackError.message
          );
        }
      }

      throw error;
    }

    return {
      success: true,
      message:
        options.processName +
        ' berhasil.',
      data: {
        processNo:
          processNo,
        processType:
          options.outputTransactionType,
        parentPartId:
          parentPartId,
        outputQty:
          qtyOutput,
        outputBatchNo:
          outputBatchNo,
        sourceWarehouse:
          sourceWarehouse.WarehouseCode,
        outputWarehouse:
          outputWarehouse.WarehouseCode,
        consumption:
          consumptionPlan,
        transactionCount:
          transactionObjects.length
      }
    };

  } finally {
    lock.releaseLock();
  }
}


/* =========================================================
   GET AVAILABLE BATCHES
========================================================= */

function getAvailableBatches(
  partId,
  warehouseId
) {

  const sheet =
    getSheet(CONFIG.SHEETS.INVENTORY_BALANCE);

  const data =
    getSheetData(sheet);

  const map =
    getColumnMap(data.headers);

  const result = [];

  data.rows.forEach(row => {

    const rowPart =
      String(row[map.partid] || '').trim();

    const rowWarehouse =
      String(row[map.warehouseid] || '').trim();

    if (
      rowPart !== String(partId).trim() ||
      rowWarehouse !== String(warehouseId).trim()
    ) {
      return;
    }

    const qty =
      Number(row[map.qtyonhand] || 0);

    if (qty <= 0) return;

    result.push({
      batchNo:
        String(row[map.batchno] || '').trim(),
      qty:
        qty
    });
  });

  return result;
}


/* =========================================================
   ROUND QUANTITY
========================================================= */

function roundQuantity(value) {

  return Math.round(
    Number(value || 0) * 1000000
  ) / 1000000;
}


/* =========================================================
   APPEND MULTIPLE OBJECTS
========================================================= */

function appendObjectsBatch(
  sheet,
  objects
) {

  if (!objects || objects.length === 0) {
    return;
  }

  const lastColumn =
    sheet.getLastColumn();

  if (lastColumn < 1) {
    throw new Error(
      'Sheet tidak mempunyai header: ' +
      sheet.getName()
    );
  }

  const headers =
    sheet
      .getRange(1, 1, 1, lastColumn)
      .getValues()[0];

  const rows = objects.map(object => {

    const normalizedObject = {};

    Object.keys(object).forEach(key => {
      normalizedObject[normalizeKey(key)] =
        object[key];
    });

    return headers.map(header => {

      const key = normalizeKey(header);

      if (
        Object.prototype.hasOwnProperty.call(
          normalizedObject,
          key
        )
      ) {
        return normalizedObject[key];
      }

      return '';
    });
  });

  sheet
    .getRange(
      sheet.getLastRow() + 1,
      1,
      rows.length,
      headers.length
    )
    .setValues(rows);
}


/* =========================================================
   DELETE TRANSACTION
   ADMIN ONLY
========================================================= */

function deleteTransaction(
  data
) {

  const d =
    normalizeInput(data);


  const username =
    d.username;


  const transactionId =
    String(
      d.transactionId || ''
    ).trim();


  if (!username) {

    throw new Error(
      'Username wajib diisi.'
    );

  }


  if (!transactionId) {

    throw new Error(
      'TransactionID wajib diisi.'
    );

  }


  const user =
    getUserByUsername(
      username
    );


  if (!user) {

    throw new Error(
      'User tidak ditemukan.'
    );

  }


  if (

    String(
      user.Role || ''
    ).toUpperCase()

    !==

    'ADMIN'

  ) {

    throw new Error(
      'Hanya ADMIN yang boleh menghapus transaction.'
    );

  }


  const sheet =
    getSheet(
      CONFIG.SHEETS.TRANSACTION
    );


  const dataSet =
    getSheetData(sheet);


  const map =
    getColumnMap(
      dataSet.headers
    );


  let rowNumber =
    -1;


  let transaction =
    null;


  for (
    let i = 0;
    i < dataSet.rows.length;
    i++
  ) {

    const row =
      dataSet.rows[i];


    const rowId =
      String(
        row[map.transactionid] || ''
      ).trim();


    if (
      rowId ===
      transactionId
    ) {

      transaction =
        rowToObject(
          dataSet.headers,
          row
        );


      rowNumber =
        i + 2;


      break;

    }

  }


  if (!transaction) {

    throw new Error(
      'Transaction tidak ditemukan: ' +
      transactionId
    );

  }


  if (

    String(
      transaction.Status || ''
    ).toUpperCase()

    !==

    'COMPLETED'

  ) {

    throw new Error(
      'Transaction bukan status COMPLETED.'
    );

  }


  const partId =
    transaction.PartID;


  const qty =
    Number(
      transaction.Qty || 0
    );


  const batchNo =
    transaction.BatchNo || '';


  const fromWarehouseId =
    transaction.FromWarehouseID || '';


  const toWarehouseId =
    transaction.ToWarehouseID || '';


  const uom =
    transaction.UOM || 'PCS';


  const now =
    new Date();


  /*
   * CEK DESTINATION SEBELUM
   * MELAKUKAN REVERSAL
   */

  if (toWarehouseId) {

    const destinationStock =
      getBalanceQty({

        partId:
          partId,

        warehouseId:
          toWarehouseId,

        batchNo:
          batchNo

      });


    if (
      destinationStock < qty
    ) {

      throw new Error(

        'Transaction tidak dapat dihapus.\n\n' +

        'Stock di warehouse tujuan tidak cukup untuk reversal.\n\n' +

        'Stock sekarang: ' +
        destinationStock +

        '\nQty reversal: ' +
        qty

      );

    }

  }


  /*
   * FROM +
   */

  if (fromWarehouseId) {

    updateBalance({

      partId:
        partId,

      warehouseId:
        fromWarehouseId,

      batchNo:
        batchNo,

      delta:
        qty,

      uom:
        uom,

      transactionDate:
        now

    });

  }


  /*
   * TO -
   */

  if (toWarehouseId) {

    updateBalance({

      partId:
        partId,

      warehouseId:
        toWarehouseId,

      batchNo:
        batchNo,

      delta:
        -qty,

      uom:
        uom,

      transactionDate:
        now

    });

  }


  /*
   * DELETE TRANSACTION ROW
   */

  sheet.deleteRow(
    rowNumber
  );


  return {

    success: true,

    message:
      'Transaction berhasil dihapus dan stock dikembalikan.',

    data: {

      transactionId:
        transactionId,

      partId:
        partId,

      qty:
        qty

    }

  };

}


/* =========================================================
   UPDATE INVENTORY BALANCE
========================================================= */

function updateBalance(
  data
) {

  const partId =
    String(
      data.partId
    ).trim();


  const warehouseId =
    String(
      data.warehouseId
    ).trim();


  const batchNo =
    String(
      data.batchNo || ''
    ).trim();


  const delta =
    Number(
      data.delta
    );


  const uom =
    data.uom || 'PCS';


  const transactionDate =
    data.transactionDate ||
    new Date();


  const sheet =
    getSheet(
      CONFIG.SHEETS.INVENTORY_BALANCE
    );


  const dataSet =
    getSheetData(sheet);


  const map =
    getColumnMap(
      dataSet.headers
    );


  let foundRow =
    -1;


  let currentQty =
    0;


  let reservedQty =
    0;


  for (
    let i = 0;
    i < dataSet.rows.length;
    i++
  ) {

    const row =
      dataSet.rows[i];


    const rowPartId =
      String(
        row[map.partid] || ''
      ).trim();


    const rowWarehouseId =
      String(
        row[map.warehouseid] || ''
      ).trim();


    const rowBatch =
      String(
        row[map.batchno] || ''
      ).trim();


    if (

      rowPartId ===
      partId &&

      rowWarehouseId ===
      warehouseId &&

      rowBatch ===
      batchNo

    ) {

      foundRow =
        i + 2;


      currentQty =
        Number(
          row[map.qtyonhand] || 0
        );


      reservedQty =
        Number(
          row[map.qtyreserved] || 0
        );


      break;

    }

  }


  const newQty =
    currentQty + delta;


  if (
    newQty < 0
  ) {

    throw new Error(

      'Stock tidak boleh minus.\n\n' +

      'Part: ' +
      partId +

      '\nWarehouse: ' +
      warehouseId +

      '\nBatch: ' +
      batchNo +

      '\nCurrent: ' +
      currentQty +

      '\nDelta: ' +
      delta

    );

  }


  const availableQty =
    newQty - reservedQty;


  /*
   * CREATE NEW BALANCE
   */

  if (
    foundRow === -1
  ) {

    if (
      delta < 0
    ) {

      throw new Error(
        'Stock belum tersedia.'
      );

    }


    appendObject(

      sheet,

      {

        BalanceID:
          generateId('BAL'),

        PartID:
          partId,

        WarehouseID:
          warehouseId,

        BatchNo:
          batchNo,

        QtyOnHand:
          newQty,

        QtyReserved:
          reservedQty,

        QtyAvailable:
          availableQty,

        LastTransactionAt:
          transactionDate,

        UpdatedAt:
          new Date()

      }

    );


    return;

  }


  /*
   * UPDATE QTY ON HAND
   */

  if (
    map.qtyonhand !== undefined
  ) {

    sheet
      .getRange(

        foundRow,

        map.qtyonhand + 1

      )
      .setValue(
        newQty
      );

  }


  /*
   * UPDATE RESERVED
   */

  if (
    map.qtyreserved !== undefined
  ) {

    sheet
      .getRange(

        foundRow,

        map.qtyreserved + 1

      )
      .setValue(
        reservedQty
      );

  }


  /*
   * UPDATE AVAILABLE
   */

  if (
    map.qtyavailable !== undefined
  ) {

    sheet
      .getRange(

        foundRow,

        map.qtyavailable + 1

      )
      .setValue(
        availableQty
      );

  }


  /*
   * LAST TRANSACTION
   */

  if (
    map.lasttransactionat !== undefined
  ) {

    sheet
      .getRange(

        foundRow,

        map.lasttransactionat + 1

      )
      .setValue(
        transactionDate
      );

  }


  /*
   * UPDATED AT
   */

  if (
    map.updatedat !== undefined
  ) {

    sheet
      .getRange(

        foundRow,

        map.updatedat + 1

      )
      .setValue(
        new Date()
      );

  }

}


/* =========================================================
   GET BALANCE
========================================================= */

function getBalanceQty(
  data
) {

  const partId =
    String(
      data.partId
    ).trim();


  const warehouseId =
    String(
      data.warehouseId
    ).trim();


  const batchNo =
    String(
      data.batchNo || ''
    ).trim();


  const sheet =
    getSheet(
      CONFIG.SHEETS.INVENTORY_BALANCE
    );


  const dataSet =
    getSheetData(sheet);


  const map =
    getColumnMap(
      dataSet.headers
    );


  for (
    let i = 0;
    i < dataSet.rows.length;
    i++
  ) {

    const row =
      dataSet.rows[i];


    if (

      String(
        row[map.partid] || ''
      ).trim()
      ===
      partId

      &&

      String(
        row[map.warehouseid] || ''
      ).trim()
      ===
      warehouseId

      &&

      String(
        row[map.batchno] || ''
      ).trim()
      ===
      batchNo

    ) {

      return Number(
        row[map.qtyonhand] || 0
      );

    }

  }


  return 0;

}


/* =========================================================
   FIND WAREHOUSE BY CODE
========================================================= */

function findWarehouseByCode(
  code
) {

  const sheet =
    getSheet(
      CONFIG.SHEETS.WAREHOUSE
    );


  const data =
    getSheetData(sheet);


  for (
    let i = 0;
    i < data.rows.length;
    i++
  ) {

    const obj =
      rowToObject(
        data.headers,
        data.rows[i]
      );


    if (

      String(
        obj.WarehouseCode || ''
      )
      .trim()
      .toUpperCase()

      ===

      String(code)
      .trim()
      .toUpperCase()

    ) {

      return obj;

    }

  }


  return null;

}


/* =========================================================
   FIND WAREHOUSE BY ID
========================================================= */

function findWarehouseById(
  id
) {

  const sheet =
    getSheet(
      CONFIG.SHEETS.WAREHOUSE
    );


  const data =
    getSheetData(sheet);


  for (
    let i = 0;
    i < data.rows.length;
    i++
  ) {

    const obj =
      rowToObject(
        data.headers,
        data.rows[i]
      );


    if (

      String(
        obj.WarehouseID || ''
      )
      .trim()

      ===

      String(id)
      .trim()

    ) {

      return obj;

    }

  }


  return null;

}


/* =========================================================
   VALIDATE PART
========================================================= */

function validatePart(
  partId
) {

  const sheet =
    getSheet(
      CONFIG.SHEETS.MASTER_PART
    );


  const data =
    getSheetData(sheet);


  for (
    let i = 0;
    i < data.rows.length;
    i++
  ) {

    const obj =
      rowToObject(
        data.headers,
        data.rows[i]
      );


    if (

      String(
        obj.PartID || ''
      ).trim()

      ===

      String(partId)
        .trim()

    ) {

      if (

        obj.Status &&

        String(
          obj.Status
        ).toUpperCase()

        !==

        'ACTIVE'

      ) {

        throw new Error(
          'Part tidak aktif: ' +
          partId
        );

      }


      return true;

    }

  }


  throw new Error(

    'PartID tidak ditemukan di MasterPart: ' +
    partId

  );

}


/* =========================================================
   REBUILD INVENTORY
========================================================= */

function rebuildInventory() {

  const ui =
    SpreadsheetApp.getUi();


  const confirm =
    ui.alert(

      'REBUILD INVENTORY',

      'InventoryBalance akan dihitung ulang dari Transaction.\n\nLanjutkan?',

      ui.ButtonSet.YES_NO

    );


  if (
    confirm !==
    ui.Button.YES
  ) {

    return;

  }


  const txSheet =
    getSheet(
      CONFIG.SHEETS.TRANSACTION
    );


  const balanceSheet =
    getSheet(
      CONFIG.SHEETS.INVENTORY_BALANCE
    );


  const txData =
    getSheetData(
      txSheet
    );


  const balances = {};


  txData.rows.forEach(row => {

    const tx =
      rowToObject(
        txData.headers,
        row
      );


    if (

      String(
        tx.Status || ''
      ).toUpperCase()

      !==

      'COMPLETED'

    ) {

      return;

    }


    const partId =
      String(
        tx.PartID || ''
      ).trim();


    const batchNo =
      String(
        tx.BatchNo || ''
      ).trim();


    const qty =
      Number(
        tx.Qty || 0
      );


    const from =
      String(
        tx.FromWarehouseID || ''
      ).trim();


    const to =
      String(
        tx.ToWarehouseID || ''
      ).trim();


    if (
      !partId ||
      !qty
    ) {

      return;

    }


    /*
     * FROM -
     */

    if (from) {

      const key =
        makeBalanceKey(

          partId,

          from,

          batchNo

        );


      if (
        !balances[key]
      ) {

        balances[key] = {

          partId:
            partId,

          warehouseId:
            from,

          batchNo:
            batchNo,

          qty:
            0,

          uom:
            tx.UOM || 'PCS'

        };

      }


      balances[key].qty -=
        qty;

    }


    /*
     * TO +
     */

    if (to) {

      const key =
        makeBalanceKey(

          partId,

          to,

          batchNo

        );


      if (
        !balances[key]
      ) {

        balances[key] = {

          partId:
            partId,

          warehouseId:
            to,

          batchNo:
            batchNo,

          qty:
            0,

          uom:
            tx.UOM || 'PCS'

        };

      }


      balances[key].qty +=
        qty;

    }

  });


  /*
   * CHECK NEGATIVE
   */

  Object.keys(
    balances
  ).forEach(key => {

    if (
      balances[key].qty < 0
    ) {

      throw new Error(

        'Rebuild menghasilkan stock minus:\n' +

        balances[key].partId +

        ' / ' +

        balances[key].warehouseId +

        ' / ' +

        balances[key].batchNo +

        ' = ' +

        balances[key].qty

      );

    }

  });


  /*
   * CLEAR BALANCE
   */

  if (
    balanceSheet.getLastRow() > 1
  ) {

    balanceSheet
      .getRange(

        2,

        1,

        balanceSheet.getLastRow() - 1,

        balanceSheet.getLastColumn()

      )
      .clearContent();

  }


  /*
   * WRITE BALANCE
   */

  Object.keys(
    balances
  ).forEach(key => {

    const b =
      balances[key];


    appendObject(

      balanceSheet,

      {

        BalanceID:
          generateId('BAL'),

        PartID:
          b.partId,

        WarehouseID:
          b.warehouseId,

        BatchNo:
          b.batchNo,

        QtyOnHand:
          b.qty,

        QtyReserved:
          0,

        QtyAvailable:
          b.qty,

        LastTransactionAt:
          new Date(),

        UpdatedAt:
          new Date()

      }

    );

  });


  ui.alert(

    'REBUILD BERHASIL',

    'InventoryBalance berhasil dihitung ulang.',

    ui.ButtonSet.OK

  );

}


/* =========================================================
   SETUP ADMIN
========================================================= */

function setupAdminUser() {

  const sheet =
    getSheet(
      CONFIG.SHEETS.USERS
    );


  const existing =
    getUserByUsername(
      'admin'
    );


  if (existing) {

    SpreadsheetApp.getUi().alert(

      'ADMIN SUDAH ADA',

      'Username admin sudah tersedia.\n\n' +

      'Username: admin',

      SpreadsheetApp.getUi().ButtonSet.OK

    );

    return;

  }


  appendObject(

    sheet,

    {

      UserID:
        generateId('USR'),

      Username:
        'admin',

      FullName:
        'Administrator',

      Role:
        'ADMIN',

      PasswordHash:
        hashPassword(
          'admin123'
        ),

      Status:
        'ACTIVE',

      CreatedAt:
        new Date()

    }

  );


  SpreadsheetApp.getUi().alert(

    'ADMIN BERHASIL DIBUAT',

    'Username : admin\n' +
    'Password : admin123\n' +
    'Role : ADMIN',

    SpreadsheetApp.getUi().ButtonSet.OK

  );

}


/* =========================================================
   TEST RECEIVING
========================================================= */

function testReceiving() {

  const ui =
    SpreadsheetApp.getUi();


  const part =
    ui.prompt(

      'TEST RECEIVING',

      'Masukkan PartID:\nContoh: P001',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    part.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  const qty =
    ui.prompt(

      'TEST RECEIVING',

      'Masukkan Quantity:\nContoh: 100',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    qty.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  const batch =
    ui.prompt(

      'TEST RECEIVING',

      'Masukkan Batch No:\nContoh: BATCH001',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    batch.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  const reference =
    ui.prompt(

      'TEST RECEIVING',

      'Masukkan Reference No:\nContoh: PO-TEST-001',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    reference.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  try {

    const result =
      receiveMaterial({

        username:
          'admin',

        partId:
          part.getResponseText()
            .trim(),

        qty:
          Number(
            qty.getResponseText()
          ),

        uom:
          'PCS',

        batchNo:
          batch.getResponseText()
            .trim(),

        referenceNo:
          reference
            .getResponseText()
            .trim(),

        supplierId:
          ''

      });


    ui.alert(

      'RECEIVING BERHASIL',

      JSON.stringify(
        result,
        null,
        2
      ),

      ui.ButtonSet.OK

    );


  } catch (error) {

    ui.alert(

      'RECEIVING GAGAL',

      error.message,

      ui.ButtonSet.OK

    );

  }

}


/* =========================================================
   TEST TRANSFER
========================================================= */

function testTransfer() {

  const ui =
    SpreadsheetApp.getUi();


  const part =
    ui.prompt(

      'TEST TRANSFER',

      'Masukkan PartID:\nContoh: P001',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    part.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  const from =
    ui.prompt(

      'TEST TRANSFER',

      'Dari Warehouse Code:\n\n' +
      'STG\n' +
      'WH-L2\n' +
      'WH-INV',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    from.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  const to =
    ui.prompt(

      'TEST TRANSFER',

      'Ke Warehouse Code:\n\n' +
      'WH-L2\n' +
      'WH-INV',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    to.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  const qty =
    ui.prompt(

      'TEST TRANSFER',

      'Masukkan Quantity:\nContoh: 50',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    qty.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  const batch =
    ui.prompt(

      'TEST TRANSFER',

      'Masukkan Batch No:\nContoh: BATCH001',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    batch.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  try {

    const fromWarehouse =
      findWarehouseByCode(

        from.getResponseText()
          .trim()

      );


    const toWarehouse =
      findWarehouseByCode(

        to.getResponseText()
          .trim()

      );


    if (!fromWarehouse) {

      throw new Error(

        'Warehouse asal tidak ditemukan: ' +
        from.getResponseText()

      );

    }


    if (!toWarehouse) {

      throw new Error(

        'Warehouse tujuan tidak ditemukan: ' +
        to.getResponseText()

      );

    }


    const result =
      transferStock({

        username:
          'admin',

        partId:
          part.getResponseText()
            .trim(),

        fromWarehouseId:
          fromWarehouse.WarehouseID,

        toWarehouseId:
          toWarehouse.WarehouseID,

        qty:
          Number(
            qty.getResponseText()
          ),

        uom:
          'PCS',

        batchNo:
          batch.getResponseText()
            .trim(),

        referenceNo:
          'TEST-TRANSFER'

      });


    ui.alert(

      'TRANSFER BERHASIL',

      JSON.stringify(
        result,
        null,
        2
      ),

      ui.ButtonSet.OK

    );


  } catch (error) {

    ui.alert(

      'TRANSFER GAGAL',

      error.message,

      ui.ButtonSet.OK

    );

  }

}


/* =========================================================
   TEST ISSUE
========================================================= */

function testIssue() {

  const ui =
    SpreadsheetApp.getUi();


  const part =
    ui.prompt(

      'TEST ISSUE',

      'Masukkan PartID:\nContoh: P001',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    part.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  const from =
    ui.prompt(

      'TEST ISSUE',

      'Dari Warehouse Code:\n\n' +
      'WH-L2\n' +
      'WH-INV',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    from.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  const qty =
    ui.prompt(

      'TEST ISSUE',

      'Masukkan Quantity:\nContoh: 20',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    qty.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  const batch =
    ui.prompt(

      'TEST ISSUE',

      'Masukkan Batch No:\nContoh: BATCH001',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    batch.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  try {

    const fromWarehouse =
      findWarehouseByCode(

        from.getResponseText()
          .trim()

      );


    if (!fromWarehouse) {

      throw new Error(

        'Warehouse tidak ditemukan: ' +
        from.getResponseText()

      );

    }


    const result =
      issueMaterial({

        username:
          'admin',

        partId:
          part.getResponseText()
            .trim(),

        fromWarehouseId:
          fromWarehouse.WarehouseID,

        qty:
          Number(
            qty.getResponseText()
          ),

        uom:
          'PCS',

        batchNo:
          batch.getResponseText()
            .trim(),

        referenceNo:
          'TEST-ISSUE'

      });


    ui.alert(

      'ISSUE BERHASIL',

      JSON.stringify(
        result,
        null,
        2
      ),

      ui.ButtonSet.OK

    );


  } catch (error) {

    ui.alert(

      'ISSUE GAGAL',

      error.message,

      ui.ButtonSet.OK

    );

  }

}


/* =========================================================
   TEST SUB ASSEMBLY
========================================================= */

function testSubAssembly() {

  const ui = SpreadsheetApp.getUi();

  const part = ui.prompt(
    'TEST SUB ASSEMBLY',
    'Masukkan Parent PartID Sub Assembly:\nContoh: P003',
    ui.ButtonSet.OK_CANCEL
  );

  if (part.getSelectedButton() !== ui.Button.OK) return;

  const qty = ui.prompt(
    'TEST SUB ASSEMBLY',
    'Masukkan Qty hasil Sub Assembly:\nContoh: 10',
    ui.ButtonSet.OK_CANCEL
  );

  if (qty.getSelectedButton() !== ui.Button.OK) return;

  const batch = ui.prompt(
    'TEST SUB ASSEMBLY',
    'Masukkan Batch No output Sub Assembly:\nContoh: SA-BATCH001',
    ui.ButtonSet.OK_CANCEL
  );

  if (batch.getSelectedButton() !== ui.Button.OK) return;

  const reference = ui.prompt(
    'TEST SUB ASSEMBLY',
    'Reference No (opsional):\nContoh: SA-TEST-001',
    ui.ButtonSet.OK_CANCEL
  );

  if (reference.getSelectedButton() !== ui.Button.OK) return;

  try {

    const result = createSubAssembly({
      username: 'admin',
      parentPartId:
        part.getResponseText().trim(),
      qty:
        Number(qty.getResponseText()),
      uom: 'PCS',
      outputBatchNo:
        batch.getResponseText().trim(),
      referenceNo:
        reference.getResponseText().trim(),
      remarks:
        'TEST SUB ASSEMBLY'
    });

    ui.alert(
      'SUB ASSEMBLY BERHASIL',
      JSON.stringify(result, null, 2),
      ui.ButtonSet.OK
    );

  } catch (error) {

    ui.alert(
      'SUB ASSEMBLY GAGAL',
      error.message,
      ui.ButtonSet.OK
    );
  }
}


/* =========================================================
   TEST FINISH PRODUCT
========================================================= */

function testFinishProduct() {

  const ui = SpreadsheetApp.getUi();

  const part = ui.prompt(
    'TEST FINISH PRODUCT',
    'Masukkan Parent PartID Finish Product:\nContoh: P004',
    ui.ButtonSet.OK_CANCEL
  );

  if (part.getSelectedButton() !== ui.Button.OK) return;

  const qty = ui.prompt(
    'TEST FINISH PRODUCT',
    'Masukkan Qty Finish Product:\nContoh: 10',
    ui.ButtonSet.OK_CANCEL
  );

  if (qty.getSelectedButton() !== ui.Button.OK) return;

  const batch = ui.prompt(
    'TEST FINISH PRODUCT',
    'Masukkan Batch No output Testing:\nContoh: FG-BATCH001',
    ui.ButtonSet.OK_CANCEL
  );

  if (batch.getSelectedButton() !== ui.Button.OK) return;

  const reference = ui.prompt(
    'TEST FINISH PRODUCT',
    'Reference No (opsional):\nContoh: FG-TEST-001',
    ui.ButtonSet.OK_CANCEL
  );

  if (reference.getSelectedButton() !== ui.Button.OK) return;

  try {

    const result = createFinishProduct({
      username: 'admin',
      parentPartId:
        part.getResponseText().trim(),
      qty:
        Number(qty.getResponseText()),
      uom: 'PCS',
      outputBatchNo:
        batch.getResponseText().trim(),
      referenceNo:
        reference.getResponseText().trim(),
      remarks:
        'TEST FINISH PRODUCT'
    });

    ui.alert(
      'FINISH PRODUCT → TESTING BERHASIL',
      JSON.stringify(result, null, 2),
      ui.ButtonSet.OK
    );

  } catch (error) {

    ui.alert(
      'FINISH PRODUCT GAGAL',
      error.message,
      ui.ButtonSet.OK
    );
  }
}



/* =========================================================
   MATERIAL NG
   PROD -> MAT-NG
========================================================= */
function recordMaterialNG(data) {
  const d = normalizeInput(data);
  validateRequired(d, ['partId','qty','batchNo']);
  const production = findWarehouseByCode(CONFIG.WAREHOUSE_CODES.PRODUCTION);
  const materialNG = findWarehouseByCode(CONFIG.WAREHOUSE_CODES.MATERIAL_NG);
  if (!production) throw new Error('Warehouse PROD tidak ditemukan.');
  if (!materialNG) throw new Error('Warehouse MAT-NG tidak ditemukan. Jalankan Setup Warehouse Final.');
  d.fromWarehouseId = production.WarehouseID;
  d.toWarehouseId = materialNG.WarehouseID;
  const result = moveStockWithTransactionType(d, 'MATERIAL_NG');
  return {success:true, message:'Material NG berhasil dipindahkan ke MAT-NG.', data:result.data};
}

/* =========================================================
   TESTING PASS
   TEST -> FG
========================================================= */
function testingPass(data) {
  const d = normalizeInput(data);
  validateRequired(d, ['partId','qty','batchNo']);
  const testing = findWarehouseByCode(CONFIG.WAREHOUSE_CODES.TESTING);
  const fg = findWarehouseByCode(CONFIG.WAREHOUSE_CODES.FINISHED_GOODS);
  if (!testing) throw new Error('Warehouse TEST tidak ditemukan.');
  if (!fg) throw new Error('Warehouse FG tidak ditemukan.');
  d.fromWarehouseId = testing.WarehouseID;
  d.toWarehouseId = fg.WarehouseID;
  const result = moveStockWithTransactionType(d, 'TEST_PASS');
  return {success:true, message:'Testing PASS berhasil. Produk masuk FG.', data:result.data};
}

/* =========================================================
   TESTING NG
   TEST -> HOLD
========================================================= */
function testingNG(data) {
  const d = normalizeInput(data);
  validateRequired(d, ['partId','qty','batchNo']);
  const testing = findWarehouseByCode(CONFIG.WAREHOUSE_CODES.TESTING);
  const hold = findWarehouseByCode(CONFIG.WAREHOUSE_CODES.HOLD_REJECT);
  if (!testing) throw new Error('Warehouse TEST tidak ditemukan.');
  if (!hold) throw new Error('Warehouse HOLD tidak ditemukan. Jalankan Setup Warehouse Final.');
  d.fromWarehouseId = testing.WarehouseID;
  d.toWarehouseId = hold.WarehouseID;
  const result = moveStockWithTransactionType(d, 'TEST_NG');
  return {success:true, message:'Testing NG berhasil. Produk masuk HOLD.', data:result.data};
}

/* =========================================================
   SETUP WAREHOUSE FINAL
   Menambahkan TEST, MAT-NG, HOLD jika belum ada.
========================================================= */
function setupFinalWarehouses() {
  const sheet = getSheet(CONFIG.SHEETS.WAREHOUSE);
  const definitions = [
    {id:'WH007', code:'MAT-NG', name:'Material NG', type:'MATERIAL_NG', parent:'WH004'},
    {id:'WH008', code:'TEST', name:'Testing', type:'TESTING', parent:'WH004'},
    {id:'WH009', code:'HOLD', name:'Product NG / Hold', type:'HOLD_REJECT', parent:'WH008'}
  ];
  const added=[]; const existed=[];
  definitions.forEach(item=>{
    const existing=findWarehouseByCode(item.code);
    if(existing){existed.push(item.code);return;}
    appendObject(sheet,{WarehouseID:item.id,WarehouseCode:item.code,WarehouseName:item.name,WarehouseType:item.type,ParentWarehouseID:item.parent,Status:'ACTIVE'});
    added.push(item.code);
  });
  SpreadsheetApp.getUi().alert('SETUP WAREHOUSE FINAL','Ditambahkan: '+(added.length?added.join(', '):'Tidak ada')+'\nSudah ada: '+(existed.length?existed.join(', '):'Tidak ada'),SpreadsheetApp.getUi().ButtonSet.OK);
  return {success:true,added:added,existed:existed};
}

/* =========================================================
   TEST MATERIAL NG
========================================================= */
function testMaterialNG() {
  const ui=SpreadsheetApp.getUi();
  const part=ui.prompt('TEST MATERIAL NG','Masukkan PartID material NG:\nContoh: P001',ui.ButtonSet.OK_CANCEL); if(part.getSelectedButton()!==ui.Button.OK)return;
  const qty=ui.prompt('TEST MATERIAL NG','Masukkan Qty NG:\nContoh: 2',ui.ButtonSet.OK_CANCEL); if(qty.getSelectedButton()!==ui.Button.OK)return;
  const batch=ui.prompt('TEST MATERIAL NG','Masukkan Batch No:\nContoh: BATCH001',ui.ButtonSet.OK_CANCEL); if(batch.getSelectedButton()!==ui.Button.OK)return;
  const reason=ui.prompt('TEST MATERIAL NG','Alasan NG:',ui.ButtonSet.OK_CANCEL); if(reason.getSelectedButton()!==ui.Button.OK)return;
  try{const result=recordMaterialNG({username:'admin',partId:part.getResponseText().trim(),qty:Number(qty.getResponseText()),uom:'PCS',batchNo:batch.getResponseText().trim(),referenceNo:'MAT-NG-TEST',remarks:'MATERIAL NG | Reason: '+reason.getResponseText().trim()});ui.alert('MATERIAL NG BERHASIL',JSON.stringify(result,null,2),ui.ButtonSet.OK);}catch(error){ui.alert('MATERIAL NG GAGAL',error.message,ui.ButtonSet.OK);}
}

/* =========================================================
   TEST TESTING PASS
========================================================= */
function testTestingPass() {
  const ui=SpreadsheetApp.getUi();
  const part=ui.prompt('TESTING PASS','Masukkan PartID Finish Product:\nContoh: P004',ui.ButtonSet.OK_CANCEL); if(part.getSelectedButton()!==ui.Button.OK)return;
  const qty=ui.prompt('TESTING PASS','Masukkan Qty PASS:\nContoh: 10',ui.ButtonSet.OK_CANCEL); if(qty.getSelectedButton()!==ui.Button.OK)return;
  const batch=ui.prompt('TESTING PASS','Masukkan Batch No yang ada di TEST:\nContoh: FG-BATCH001',ui.ButtonSet.OK_CANCEL); if(batch.getSelectedButton()!==ui.Button.OK)return;
  const reference=ui.prompt('TESTING PASS','Reference No (opsional):',ui.ButtonSet.OK_CANCEL); if(reference.getSelectedButton()!==ui.Button.OK)return;
  try{const result=testingPass({username:'admin',partId:part.getResponseText().trim(),qty:Number(qty.getResponseText()),uom:'PCS',batchNo:batch.getResponseText().trim(),referenceNo:reference.getResponseText().trim()||'TEST-PASS-TEST',remarks:'TESTING PASS'});ui.alert('TESTING PASS BERHASIL',JSON.stringify(result,null,2),ui.ButtonSet.OK);}catch(error){ui.alert('TESTING PASS GAGAL',error.message,ui.ButtonSet.OK);}
}

/* =========================================================
   TEST TESTING NG
========================================================= */
function testTestingNG() {
  const ui=SpreadsheetApp.getUi();
  const part=ui.prompt('TESTING NG','Masukkan PartID Finish Product:\nContoh: P004',ui.ButtonSet.OK_CANCEL); if(part.getSelectedButton()!==ui.Button.OK)return;
  const qty=ui.prompt('TESTING NG','Masukkan Qty NG:\nContoh: 1',ui.ButtonSet.OK_CANCEL); if(qty.getSelectedButton()!==ui.Button.OK)return;
  const batch=ui.prompt('TESTING NG','Masukkan Batch No yang ada di TEST:\nContoh: FG-BATCH001',ui.ButtonSet.OK_CANCEL); if(batch.getSelectedButton()!==ui.Button.OK)return;
  const reason=ui.prompt('TESTING NG','Alasan testing NG:',ui.ButtonSet.OK_CANCEL); if(reason.getSelectedButton()!==ui.Button.OK)return;
  try{const result=testingNG({username:'admin',partId:part.getResponseText().trim(),qty:Number(qty.getResponseText()),uom:'PCS',batchNo:batch.getResponseText().trim(),referenceNo:'TEST-NG-TEST',remarks:'TESTING NG | Reason: '+reason.getResponseText().trim()});ui.alert('TESTING NG BERHASIL',JSON.stringify(result,null,2),ui.ButtonSet.OK);}catch(error){ui.alert('TESTING NG GAGAL',error.message,ui.ButtonSet.OK);}
}

/* =========================================================
   TEST DELETE
========================================================= */

function testDeleteTransaction() {

  const ui =
    SpreadsheetApp.getUi();


  const input =
    ui.prompt(

      'TEST DELETE TRANSACTION',

      'Masukkan TransactionID:',

      ui.ButtonSet.OK_CANCEL

    );


  if (
    input.getSelectedButton()
    !==
    ui.Button.OK
  ) return;


  const transactionId =
    input
      .getResponseText()
      .trim();


  const confirm =
    ui.alert(

      'KONFIRMASI DELETE',

      'Transaction:\n\n' +
      transactionId +
      '\n\n' +
      'Stock akan otomatis dibalik.\n\n' +
      'Lanjutkan?',

      ui.ButtonSet.YES_NO

    );


  if (
    confirm !==
    ui.Button.YES
  ) return;


  try {

    const result =
      deleteTransaction({

        username:
          'admin',

        transactionId:
          transactionId

      });


    ui.alert(

      'DELETE BERHASIL',

      JSON.stringify(
        result,
        null,
        2
      ),

      ui.ButtonSet.OK

    );


  } catch (error) {

    ui.alert(

      'DELETE GAGAL',

      error.message,

      ui.ButtonSet.OK

    );

  }

}


/* =========================================================
   TEST STOCK
========================================================= */

function testCheckStock() {

  const ui =
    SpreadsheetApp.getUi();


  try {

    const result =
      getStock();


    let text =
      'Jumlah Balance: ' +
      result.count +
      '\n\n';


    result.data
      .slice(0, 20)
      .forEach(item => {

        text +=

          String(
            item.PartID || ''
          ) +

          ' | ' +

          String(
            item.WarehouseID || ''
          ) +

          ' | Batch: ' +

          String(
            item.BatchNo || ''
          ) +

          ' | Qty: ' +

          String(
            item.QtyOnHand || 0
          ) +

          '\n';

      });


    if (
      result.count > 20
    ) {

      text +=
        '\n... dan seterusnya.';

    }


    ui.alert(

      'INVENTORY BALANCE',

      text,

      ui.ButtonSet.OK

    );


  } catch (error) {

    ui.alert(

      'GAGAL CEK STOCK',

      error.message,

      ui.ButtonSet.OK

    );

  }

}


/* =========================================================
   TEST TRANSACTION
========================================================= */

function testCheckTransactions() {

  const ui =
    SpreadsheetApp.getUi();


  try {

    const result =
      getTransactions(20);


    let text =
      '20 Transaction terakhir:\n\n';


    result.data
      .forEach(tx => {

        text +=

          String(
            tx.TransactionID || ''
          ) +

          ' | ' +

          String(
            tx.TransactionType || ''
          ) +

          ' | Part: ' +

          String(
            tx.PartID || ''
          ) +

          ' | Qty: ' +

          String(
            tx.Qty || 0
          ) +

          '\n';

      });


    ui.alert(

      'TRANSACTION',

      text,

      ui.ButtonSet.OK

    );


  } catch (error) {

    ui.alert(

      'GAGAL CEK TRANSACTION',

      error.message,

      ui.ButtonSet.OK

    );

  }

}


/* =========================================================
   ADMIN DELETE MENU
========================================================= */

function showDeleteTransaction() {

  testDeleteTransaction();

}


/* =========================================================
   NORMALIZE INPUT
========================================================= */

function normalizeInput(
  data
) {

  const source =
    data || {};


  const result = {};


  Object.keys(source)
    .forEach(key => {

      result[
        normalizeKey(key)
      ] =
        source[key];

    });


  return {

    action:
      result.action || '',

    username:
      result.username || '',

    password:
      result.password || '',

    partId:
      result.partid || '',

    qty:
      result.qty,

    uom:
      result.uom || 'PCS',

    batchNo:
      result.batchno || '',

    referenceNo:
      result.referenceno || '',

    remarks:
      result.remarks || '',

    supplierId:
      result.supplierid || '',

    fromWarehouseId:
      result.fromwarehouseid || '',

    toWarehouseId:
      result.towarehouseid || '',

    transactionId:
      result.transactionid || '',

    parentPartId:
      result.parentpartid || '',

    outputBatchNo:
      result.outputbatchno ||
      result.outputbatch || '',

    productionDate:
      result.productiondate || '',

    processNo:
      result.processno || ''

  };

}


/* =========================================================
   VALIDATE REQUIRED
========================================================= */

function validateRequired(
  data,
  fields
) {

  fields.forEach(field => {

    const value =
      data[field];


    if (

      value === undefined ||

      value === null ||

      String(value)
        .trim() === ''

    ) {

      throw new Error(
        'Field wajib: ' +
        field
      );

    }

  });

}


/* =========================================================
   SHEET
========================================================= */

function getSheet(
  sheetName
) {

  const ss =
    getSpreadsheet();


  const sheet =
    ss.getSheetByName(
      sheetName
    );


  if (!sheet) {

    throw new Error(
      'Sheet tidak ditemukan: ' +
      sheetName
    );

  }


  return sheet;

}


/* =========================================================
   SHEET DATA
========================================================= */

function getSheetData(
  sheet
) {

  const lastRow =
    sheet.getLastRow();


  const lastColumn =
    sheet.getLastColumn();


  if (

    lastRow < 1 ||

    lastColumn < 1

  ) {

    return {

      headers: [],

      rows: []

    };

  }


  const values =
    sheet
      .getRange(

        1,

        1,

        lastRow,

        lastColumn

      )
      .getValues();


  return {

    headers:
      values[0],

    rows:
      values.slice(1)

  };

}


/* =========================================================
   COLUMN MAP
========================================================= */

function getColumnMap(
  headers
) {

  const map = {};


  headers.forEach(

    (header, index) => {

      map[
        normalizeKey(header)
      ] =
        index;

    }

  );


  return map;

}


/* =========================================================
   NORMALIZE KEY
========================================================= */

function normalizeKey(
  value
) {

  return String(
    value || ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ''
    );

}


/* =========================================================
   ROW TO OBJECT
========================================================= */

function rowToObject(
  headers,
  row
) {

  const obj = {};


  headers.forEach(

    (header, index) => {

      obj[header] =
        row[index];

    }

  );


  return obj;

}


/* =========================================================
   APPEND OBJECT
========================================================= */

function appendObject(
  sheet,
  object
) {

  const lastColumn =
    sheet.getLastColumn();


  if (
    lastColumn < 1
  ) {

    throw new Error(
      'Sheet tidak mempunyai header: ' +
      sheet.getName()
    );

  }


  const headers =
    sheet
      .getRange(

        1,

        1,

        1,

        lastColumn

      )
      .getValues()[0];


  const normalizedObject = {};


  Object.keys(object)
    .forEach(key => {

      normalizedObject[
        normalizeKey(key)
      ] =
        object[key];

    });


  const row =
    headers.map(header => {

      const key =
        normalizeKey(header);


      if (

        Object.prototype
          .hasOwnProperty
          .call(
            normalizedObject,
            key
          )

      ) {

        return normalizedObject[key];

      }


      return '';

    });


  sheet
    .getRange(

      sheet.getLastRow() + 1,

      1,

      1,

      row.length

    )
    .setValues([row]);

}


/* =========================================================
   ID
========================================================= */

function generateId(
  prefix
) {

  return (

    prefix +

    '-' +

    Utilities
      .getUuid()
      .replace(
        /-/g,
        ''
      )
      .substring(
        0,
        12
      )
      .toUpperCase()

  );

}


/* =========================================================
   NUMBER
========================================================= */

function generateNumber(
  prefix
) {

  const now =
    new Date();


  const timestamp =
    Utilities.formatDate(

      now,

      Session.getScriptTimeZone(),

      'yyyyMMdd-HHmmss'

    );


  const random =
    Math.floor(
      Math.random() * 1000
    )
      .toString()
      .padStart(
        3,
        '0'
      );


  return (

    prefix +
    '-' +
    timestamp +
    '-' +
    random

  );

}


/* =========================================================
   BALANCE KEY
========================================================= */

function makeBalanceKey(

  partId,

  warehouseId,

  batchNo

) {

  return (

    String(partId) +
    '|' +
    String(warehouseId) +
    '|' +
    String(batchNo || '')

  );

}


/* =========================================================
   PASSWORD HASH
========================================================= */

function hashPassword(
  password
) {

  const digest =
    Utilities.computeDigest(

      Utilities.DigestAlgorithm.SHA_256,

      String(password),

      Utilities.Charset.UTF_8

    );


  return digest

    .map(function(byte) {

      const value =
        byte < 0
          ? byte + 256
          : byte;


      return value
        .toString(16)
        .padStart(
          2,
          '0'
        );

    })

    .join('');

}


/* =========================================================
   JSON
========================================================= */

function jsonResponse(
  data
) {

  return ContentService

    .createTextOutput(
      JSON.stringify(data)
    )

    .setMimeType(
      ContentService.MimeType.JSON
    );

}

/* =========================================================
   WMS WEB API EXTENSION V2
   Adds master-data input, stock opname and FG delivery.
   Uses the existing WMS engine: updateBalance(), appendObject(),
   normalizeInput(), generateId(), generateNumber(), etc.
========================================================= */

function webTableName_(key) {
  const map = {
    parts: CONFIG.SHEETS.MASTER_PART,
    warehouses: CONFIG.SHEETS.WAREHOUSE,
    suppliers: CONFIG.SHEETS.SUPPLIER,
    customers: CONFIG.SHEETS.CUSTOMER,
    bomHeaders: CONFIG.SHEETS.BOM,
    bomDetails: CONFIG.SHEETS.BOM_DETAIL,
    receiving: CONFIG.SHEETS.RECEIVING,
    transactions: CONFIG.SHEETS.TRANSACTION,
    stock: CONFIG.SHEETS.INVENTORY_BALANCE,
    deliveries: CONFIG.SHEETS.DELIVERY,
    deliveryDetails: CONFIG.SHEETS.DELIVERY_DETAIL,
    stockOpname: CONFIG.SHEETS.STOCK_OPNAME,
    stockOpnameDetails: CONFIG.SHEETS.STOCK_OPNAME_DETAIL
  };
  if (!map[key]) throw new Error('Table tidak dikenal: ' + key);
  return map[key];
}

function webGetTable_(key) {
  const sheet = getSheet(webTableName_(key));
  const data = getSheetData(sheet);
  return {
    success: true,
    data: data.rows.map(row => rowToObject(data.headers, row)),
    count: data.rows.length
  };
}

function webMasterIdPrefix_(table) {
  return {
    parts: 'PART',
    warehouses: 'WH',
    suppliers: 'SUP',
    customers: 'CUS',
    bomHeaders: 'BOM',
    bomDetails: 'BOMD'
  }[table] || 'MST';
}

function webSaveMaster_(d) {
  const table = String(d.table || '').trim();
  const allowed = ['parts','warehouses','suppliers','customers'];
  if (!allowed.includes(table)) throw new Error('Master table tidak didukung: ' + table);

  const sheet = getSheet(webTableName_(table));
  const now = new Date();
  const idField = {
    parts:'PartID', warehouses:'WarehouseID', suppliers:'SupplierID', customers:'CustomerID'
  }[table];
  const prefix = webMasterIdPrefix_(table);
  const obj = {};

  if (table === 'parts') {
    validateRequired(d, ['partNumber','partName','uom']);
    obj.PartID = d.partId || generateId(prefix);
    obj.PartNumber = String(d.partNumber).trim();
    obj.PartName = String(d.partName).trim();
    obj.PartType = d.partType || 'MATERIAL';
    obj.Category = d.category || '';
    obj.UOM = d.uom || 'PCS';
    obj.MinStock = Number(d.minStock || 0);
    obj.MaxStock = Number(d.maxStock || 0);
    obj.Status = d.status || 'ACTIVE';
    obj.CreatedAt = now;
    obj.UpdatedAt = now;
  } else if (table === 'warehouses') {
    validateRequired(d, ['warehouseCode','warehouseName']);
    obj.WarehouseID = d.warehouseId || generateId(prefix);
    obj.WarehouseCode = String(d.warehouseCode).trim();
    obj.WarehouseName = String(d.warehouseName).trim();
    obj.WarehouseType = d.warehouseType || 'STORAGE';
    obj.ParentWarehouseID = d.parentWarehouseId || '';
    obj.Status = d.status || 'ACTIVE';
  } else if (table === 'suppliers') {
    validateRequired(d, ['supplierCode','supplierName']);
    obj.SupplierID = d.supplierId || generateId(prefix);
    obj.SupplierCode = String(d.supplierCode).trim();
    obj.SupplierName = String(d.supplierName).trim();
    obj.Contact = d.contact || '';
    obj.Address = d.address || '';
    obj.Status = d.status || 'ACTIVE';
  } else if (table === 'customers') {
    validateRequired(d, ['customerCode','customerName']);
    obj.CustomerID = d.customerId || generateId(prefix);
    obj.CustomerCode = String(d.customerCode).trim();
    obj.CustomerName = String(d.customerName).trim();
    obj.Contact = d.contact || '';
    obj.Address = d.address || '';
    obj.Status = d.status || 'ACTIVE';
  }

  appendObject(sheet, obj);
  return {success:true, message:'Data berhasil disimpan.', data:obj};
}

function webSaveBOM_(d) {
  validateRequired(d, ['parentPartId','bomVersion','effectiveDate','components']);
  validatePart(d.parentPartId);
  const components = Array.isArray(d.components) ? d.components : [];
  if (!components.length) throw new Error('Minimal 1 component BOM.');

  const bomId = generateId('BOM');
  const now = new Date();
  appendObject(getSheet(CONFIG.SHEETS.BOM), {
    BOMID: bomId,
    ParentPartID: d.parentPartId,
    BOMVersion: d.bomVersion,
    EffectiveDate: d.effectiveDate,
    Status: d.status || 'ACTIVE',
    CreatedAt: now
  });

  const details = components.map(c => ({
    BOMDetailID: generateId('BOMD'),
    BOMID: bomId,
    ComponentPartID: c.componentPartId,
    QtyPer: Number(c.qtyPer),
    UOM: c.uom || 'PCS',
    ScrapPercent: Number(c.scrapPercent || 0),
    Status: 'ACTIVE'
  }));
  details.forEach(x => validatePart(x.ComponentPartID));
  appendObjectsBatch(getSheet(CONFIG.SHEETS.BOM_DETAIL), details);
  return {success:true, message:'BOM berhasil disimpan.', data:{bomId:bomId,details:details}};
}

function webCreateDelivery_(d) {
  validateRequired(d, ['customerId','details']);
  const details = Array.isArray(d.details) ? d.details : [];
  if (!details.length) throw new Error('Minimal 1 item delivery.');

  const fg = findWarehouseByCode(CONFIG.WAREHOUSE_CODES.FINISHED_GOODS);
  if (!fg) throw new Error('Warehouse FG tidak ditemukan.');

  const username = d.username || 'admin';
  const now = new Date();
  const deliveryId = generateId('DEL');
  const deliveryNo = generateNumber('DEL');
  const txObjects = [];
  const changes = [];

  details.forEach(item => {
    const partId = String(item.partId || '').trim();
    const batchNo = String(item.batchNo || '').trim();
    const qty = Number(item.qty || 0);
    if (!partId || !batchNo || qty <= 0) throw new Error('Part, batch dan qty delivery wajib valid.');
    validatePart(partId);
    const available = getBalanceQty({partId:partId, warehouseId:fg.WarehouseID, batchNo:batchNo});
    if (available < qty) throw new Error('Stock FG tidak cukup untuk ' + partId + ' batch ' + batchNo + '. Available: ' + available);

    changes.push({partId:partId, warehouseId:fg.WarehouseID, batchNo:batchNo, delta:qty, uom:item.uom || 'PCS'});
    txObjects.push({
      TransactionID: generateId('TXN'), TransactionNo: generateNumber('TXN'), TransactionDate:now,
      TransactionType:'FG_DELIVERY', ReferenceNo:deliveryNo, PartID:partId,
      FromWarehouseID:fg.WarehouseID, ToWarehouseID:'', Qty:qty, UOM:item.uom || 'PCS', BatchNo:batchNo,
      Status:'COMPLETED', CreatedBy:username, CreatedAt:now, Remarks:d.remarks || 'FG Delivery'
    });
  });

  try {
    details.forEach(item => updateBalance({partId:item.partId,warehouseId:fg.WarehouseID,batchNo:item.batchNo,delta:-Number(item.qty),uom:item.uom||'PCS',transactionDate:now}));
    appendObject(getSheet(CONFIG.SHEETS.DELIVERY), {
      DeliveryID:deliveryId, DeliveryNo:deliveryNo, DeliveryDate:d.deliveryDate || now,
      CustomerID:d.customerId, VehicleNo:d.vehicleNo || '', DriverName:d.driverName || '',
      Status:'COMPLETED', CreatedBy:username, CreatedAt:now, ShippedAt:now, CompletedAt:now
    });
    appendObjectsBatch(getSheet(CONFIG.SHEETS.DELIVERY_DETAIL), details.map(item => ({
      DeliveryDetailID:generateId('DELD'), DeliveryID:deliveryId, PartID:item.partId,
      WarehouseID:fg.WarehouseID, BatchNo:item.batchNo, Qty:Number(item.qty), UOM:item.uom||'PCS',
      PickedQty:Number(item.qty), ShippedQty:Number(item.qty), Status:'SHIPPED'
    })));
    appendObjectsBatch(getSheet(CONFIG.SHEETS.TRANSACTION), txObjects);
  } catch (e) {
    changes.forEach(x => updateBalance({partId:x.partId,warehouseId:x.warehouseId,batchNo:x.batchNo,delta:x.delta,uom:x.uom,transactionDate:now}));
    throw e;
  }
  return {success:true,message:'FG Delivery berhasil.',data:{deliveryId:deliveryId,deliveryNo:deliveryNo}};
}

function webCreateStockOpname_(d) {
  validateRequired(d, ['warehouseId','details']);
  const details = Array.isArray(d.details) ? d.details : [];
  if (!details.length) throw new Error('Minimal 1 item stock opname.');
  const username = d.username || 'admin';
  const now = new Date();
  const opnameId = generateId('OPN');
  const opnameNo = generateNumber('OPN');
  const txObjects=[];
  const adjustment=[];

  details.forEach(item => {
    const partId=String(item.partId||'').trim();
    const batchNo=String(item.batchNo||'').trim();
    const physical=Number(item.physicalQty||0);
    if(!partId || physical < 0) throw new Error('Part dan physical qty wajib valid.');
    validatePart(partId);
    const systemQty=getBalanceQty({partId:partId,warehouseId:d.warehouseId,batchNo:batchNo});
    const diff=roundQuantity(physical-systemQty);
    adjustment.push({partId,batchNo,systemQty,physical,diff,uom:item.uom||'PCS',remarks:item.remarks||''});
    if(diff!==0){
      txObjects.push({
        TransactionID:generateId('TXN'),TransactionNo:generateNumber('TXN'),TransactionDate:now,
        TransactionType:'STOCK_ADJUSTMENT',ReferenceNo:opnameNo,PartID:partId,
        FromWarehouseID:diff<0?d.warehouseId:'',ToWarehouseID:diff>0?d.warehouseId:'',Qty:Math.abs(diff),UOM:item.uom||'PCS',BatchNo:batchNo,
        Status:'COMPLETED',CreatedBy:username,CreatedAt:now,Remarks:'Stock Opname | '+(item.remarks||'')
      });
    }
  });

  appendObject(getSheet(CONFIG.SHEETS.STOCK_OPNAME), {
    OpnameID:opnameId,OpnameNo:opnameNo,OpnameDate:d.opnameDate||now,WarehouseID:d.warehouseId,
    Status:'COMPLETED',CreatedBy:username,CreatedAt:now,ApprovedBy:username,ApprovedAt:now
  });
  appendObjectsBatch(getSheet(CONFIG.SHEETS.STOCK_OPNAME_DETAIL), adjustment.map(x=>({
    StockOpnameDetailID:generateId('OPND'),OpnameID:opnameId,PartID:x.partId,BatchNo:x.batchNo,
    SystemQty:x.systemQty,PhysicalQty:x.physical,DifferenceQty:x.diff,UOM:x.uom,AdjustmentTransactionID:'',Remarks:x.remarks
  })));

  const changed=[];
  try {
    adjustment.forEach(x=>{
      if(x.diff!==0){
        updateBalance({partId:x.partId,warehouseId:d.warehouseId,batchNo:x.batchNo,delta:x.diff,uom:x.uom,transactionDate:now});
        changed.push(x);
      }
    });
    appendObjectsBatch(getSheet(CONFIG.SHEETS.TRANSACTION),txObjects);
  } catch(e){
    changed.forEach(x=>updateBalance({partId:x.partId,warehouseId:d.warehouseId,batchNo:x.batchNo,delta:-x.diff,uom:x.uom,transactionDate:now}));
    throw e;
  }
  return {success:true,message:'Stock Opname berhasil.',data:{opnameId:opnameId,opnameNo:opnameNo,details:adjustment}};
}

/* =========================================================
   WEB GET/POST ROUTES
   Paste the following cases into the existing doGet/doPost,
   or use the generated final backend file supplied with V3.
========================================================= */
