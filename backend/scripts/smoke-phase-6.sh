#!/usr/bin/env bash
# Phase 6 smoke test: stocks/raw-materials
set -u

BASE=http://localhost:8000/api

jq_field() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d); $1}catch(e){console.error('JSON parse fail:',d.slice(0,300))}})"
}

OWNER_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | jq_field 'console.log(j.data.token)')
JASON_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Jason","pin":"111111"}' | jq_field 'console.log(j.data.token)')
AMEL_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Amel","pin":"222222"}' | jq_field 'console.log(j.data.token)')

echo ""
echo "=== 1. GET tanpa auth → 401 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" $BASE/stocks/raw-materials

echo ""
echo "=== 2. GET (Amel waiter) → 200 + 13 items ==="
RM_LIST=$(curl -s $BASE/stocks/raw-materials -H "Authorization: Bearer $AMEL_TOKEN")
echo "$RM_LIST" | jq_field 'console.log("count:", j.data.rawMaterials.length)'
echo "$RM_LIST" | jq_field 'const cats = {}; j.data.rawMaterials.forEach(rm => cats[rm.category] = (cats[rm.category]||0)+1); console.log("by category:", cats)'

echo ""
echo "=== 3. Filter ?category=bumbuDasar (kasir Jason) ==="
curl -s "$BASE/stocks/raw-materials?category=bumbuDasar" -H "Authorization: Bearer $JASON_TOKEN" | jq_field 'console.log("bumbuDasar:", j.data.rawMaterials.map(rm=>rm.name))'

echo ""
echo "=== 4. Filter ?isTracked=true (owner) → 6 items ==="
curl -s "$BASE/stocks/raw-materials?isTracked=true" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log("tracked:", j.data.rawMaterials.map(rm=>({name:rm.name, qty:rm.stockQty, min:rm.minStock, isLow:rm.isLowStock})))'

echo ""
echo "=== 5. Filter ?needsRestock=true ==="
curl -s "$BASE/stocks/raw-materials?needsRestock=true" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log("needsRestock count:", j.data.rawMaterials.length, "— names:", j.data.rawMaterials.map(rm=>rm.name))'

echo ""
echo "=== 6. Detail Beras with reminder fields ==="
BERAS_ID=$(curl -s $BASE/stocks/raw-materials -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log(j.data.rawMaterials.find(rm=>rm.name==="Beras").id)')
curl -s "$BASE/stocks/raw-materials/$BERAS_ID" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const rm=j.data.rawMaterial; console.log(JSON.stringify({name:rm.name,unit:rm.unit,stockQty:rm.stockQty,minStock:rm.minStock,isLowStock:rm.isLowStock,isNearExpiry:rm.isNearExpiry,suggestedAction:rm.suggestedAction,recentMovementsCount:rm.recentMovements.length},null,2))'

echo ""
echo "=== 7. POST create (Jason cashier) → 403 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X POST $BASE/stocks/raw-materials -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"name":"Test Garam","unit":"sachet","category":"bumbuDasar","isTracked":false}'

echo ""
echo "=== 8. POST create (owner) → 201 ==="
CREATE_RESP=$(curl -s -X POST $BASE/stocks/raw-materials -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"name":"Test Garam","unit":"sachet","category":"bumbuDasar","isTracked":false,"unitPrice":2000}')
echo "$CREATE_RESP" | head -c 400; echo
NEW_ID=$(echo "$CREATE_RESP" | jq_field 'console.log(j.data.rawMaterial.id)')
echo "New id=$NEW_ID"

echo ""
echo "=== 9. POST create duplicate name → 409 ==="
curl -s -X POST $BASE/stocks/raw-materials -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"name":"Test Garam","unit":"kg","category":"bumbuDasar","isTracked":false}' | head -c 250; echo

echo ""
echo "=== 10. POST create case-mismatched name (relies on MySQL utf8mb4_unicode_ci) → 409 ==="
curl -s -X POST $BASE/stocks/raw-materials -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"name":"test garam","unit":"kg","category":"bumbuDasar","isTracked":false}' | head -c 250; echo

echo ""
echo "=== 11. PUT /:id (owner) update unitPrice + isTracked ==="
curl -s -X PUT $BASE/stocks/raw-materials/$NEW_ID -H "Content-Type: application/json" -H "Authorization: Bearer $OWNER_TOKEN" -d '{"unitPrice":2500,"isTracked":true,"minStock":3}' | jq_field 'console.log(JSON.stringify({name:j.data.rawMaterial.name,unitPrice:j.data.rawMaterial.unitPrice,isTracked:j.data.rawMaterial.isTracked,minStock:j.data.rawMaterial.minStock,isLowStock:j.data.rawMaterial.isLowStock},null,2))'

echo ""
echo "=== 12. PUT /:id (cashier) → 403 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X PUT $BASE/stocks/raw-materials/$NEW_ID -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{"unitPrice":99}'

echo ""
echo "=== 13. POST /opname (waiter Amel) — Beras: dari 0 ke 1.5 ==="
OPNAME_BODY="{\"items\":[{\"rawMaterialId\":$BERAS_ID,\"qtyFisik\":1.5}],\"note\":\"Opname pagi\"}"
curl -s -X POST $BASE/stocks/raw-materials/opname -H "Content-Type: application/json" -H "Authorization: Bearer $AMEL_TOKEN" -d "$OPNAME_BODY" | jq_field 'console.log("After opname:", j.data.rawMaterials.map(rm=>({name:rm.name, qty:rm.stockQty})))'

echo ""
echo "=== 14. POST /opname idempotent (Beras qtyFisik=1.5 lagi) → no new movement ==="
MOVE_COUNT_BEFORE=$(curl -s "$BASE/stocks/raw-materials/$BERAS_ID?limit=50" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log(j.data.rawMaterial.recentMovements.length)')
curl -s -X POST $BASE/stocks/raw-materials/opname -H "Content-Type: application/json" -H "Authorization: Bearer $AMEL_TOKEN" -d "$OPNAME_BODY" > /dev/null
MOVE_COUNT_AFTER=$(curl -s "$BASE/stocks/raw-materials/$BERAS_ID?limit=50" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log(j.data.rawMaterial.recentMovements.length)')
echo "Movements before idempotent: $MOVE_COUNT_BEFORE, after: $MOVE_COUNT_AFTER (should be SAME)"

echo ""
echo "=== 15. POST /:id/mark-habis (Jason kasir) — Beras dari 1.5 ke 0 ==="
curl -s -X POST $BASE/stocks/raw-materials/$BERAS_ID/mark-habis -H "Content-Type: application/json" -H "Authorization: Bearer $JASON_TOKEN" -d '{}' | jq_field 'console.log("After mark-habis: qty=" + j.data.rawMaterial.stockQty)'

echo ""
echo "=== 16. POST mark-habis idempotent (sudah 0) ==="
MC_BEFORE=$(curl -s "$BASE/stocks/raw-materials/$BERAS_ID?limit=50" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log(j.data.rawMaterial.recentMovements.length)')
curl -s -X POST $BASE/stocks/raw-materials/$BERAS_ID/mark-habis -H "Content-Type: application/json" -H "Authorization: Bearer $AMEL_TOKEN" -d '{}' > /dev/null
MC_AFTER=$(curl -s "$BASE/stocks/raw-materials/$BERAS_ID?limit=50" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'console.log(j.data.rawMaterial.recentMovements.length)')
echo "Movements before idempotent mark-habis: $MC_BEFORE, after: $MC_AFTER (should be SAME)"

echo ""
echo "=== 17. GET detail Beras dengan audit trail (last 10 movements) ==="
curl -s "$BASE/stocks/raw-materials/$BERAS_ID?limit=10" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const rm=j.data.rawMaterial; console.log(JSON.stringify({name:rm.name,qty:rm.stockQty,unit:rm.unit,recentMovements:rm.recentMovements.map(m=>({delta:m.delta,reason:m.reason,note:m.note.slice(0,80)}))},null,2))'

echo ""
echo "=== 18. DELETE /:id (no FK refs, owner) — Test Garam ==="
curl -s -X DELETE $BASE/stocks/raw-materials/$NEW_ID -H "Authorization: Bearer $OWNER_TOKEN" | head -c 250; echo

echo ""
echo "=== 19. DELETE /:id (with movements, owner) — Beras ada movements → 409 ==="
curl -s -X DELETE $BASE/stocks/raw-materials/$BERAS_ID -H "Authorization: Bearer $OWNER_TOKEN" | head -c 300; echo

echo ""
echo "=== 20. DELETE /:id (waiter) → 403 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" -X DELETE $BASE/stocks/raw-materials/$BERAS_ID -H "Authorization: Bearer $AMEL_TOKEN"
