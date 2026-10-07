# WMS Web V4.2.1 – No Supplier Selection

Update from V4.2:
- Supplier menu is hidden from the WMS frontend.
- Supplier selection is removed from Receiving transaction.
- Scanner transaction no longer asks operator to select Supplier.
- QR supplier/vendor fields can still be parsed for traceability; they are not required for transaction input.
- Existing `Supplier` sheet is retained in the database for compatibility and future reference; it is not deleted.
- Part Number manual input remains available.
- QR Qty rule remains: `Q:24/3/47` => Qty `24`; `Q:48` => Qty `48`.
- Anti-double transaction protection remains.

Receiving flow:
Scan/Manual Part -> Part Number -> Qty -> UOM -> Batch -> Reference/PO -> Save Receiving.

## Stock by Warehouse
Stock now has warehouse tabs. Select ALL or a specific warehouse (STG, WH-L2, WH-INV, PROD, SUB, FG, MAT-NG, TEST, HOLD) and only that warehouse's stock lines are shown. Search then applies inside the selected warehouse.


## Stock by Warehouse
Stock page now has clickable warehouse tabs. Select ALL or a warehouse code (STG, WH-L2, WH-INV, PROD, SUB, FG, MAT-NG, TEST, HOLD) to display only stock from that warehouse. Search is applied inside the selected warehouse.
