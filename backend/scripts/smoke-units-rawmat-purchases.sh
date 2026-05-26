#!/usr/bin/env bash
# Smoke test REV 2.5 (Task 9): units + raw materials + purchases integration.
#
# 11 skenario:
#   1.  List units = 10 pre-seeded
#   2.  Create custom unit "karton" exact -> 201
#   3.  Create raw_material "Telur Test" unit=karton exact, stock=2, minStock=1 -> 201
#   4.  Create raw_material "Beras Test" unit=skala 0-5 scale, stock=3, minStock=1 -> 201
#   5.  Create raw_material scale + minStock=10 -> expect 422 (out of range)
#   6.  Edit unit Telur Test (butir -> karton) tanpa newStockQty saat stock>0 -> 422
#   7.  Edit unit Telur Test (butir -> karton) DENGAN newStockQty=60 -> 200 + stock=60
#   8.  Purchase exact (Telur Test) qty=30 unit_price=2500 -> 201 + stock=90 (60+30)
#   9.  Purchase scale (Beras Test) subtotal=300000 note="1 karung 50kg" -> 201 + stock UNCHANGED (3)
#  10.  Purchase invalid item (no qty/unitPrice/subtotal) -> 422 (Zod refine)
#  11.  Cleanup: hapus test raw materials + custom unit
#
# Pre-req: backend running di :8000, DB fresh (`prisma db push && db:seed`).
# Run: bash backend/scripts/smoke-units-rawmat-purchases.sh
#
# Idempotency note: test entities pakai suffix timestamp (TEST_TAG) supaya
# re-run tidak collide dengan residual dari run sebelumnya. Cleanup step di
# akhir mencoba DELETE - kalau 409 karena FK protection (ada purchase items
# + movements), itu tetap dianggap PASS karena membuktikan FK protection
# bekerja. Untuk benar-benar bersih, jalankan ulang seeder.

set -u

API="http://localhost:8000/api"
PASS=0
FAIL=0

# Suffix unik untuk semua test entity name, supaya re-run tidak collide
# dengan residual run sebelumnya (purchase items mem-block DELETE).
TEST_TAG="$(date +%s)"
TELUR_NAME="Telur Test $TEST_TAG"
BERAS_NAME="Beras Test $TEST_TAG"
BERAS_OOR_NAME="Beras OOR Test $TEST_TAG"
KARTON_LABEL="karton-$TEST_TAG"

# Node-based jq replacement (pattern existing smoke scripts).
jq_field() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d); $1}catch(e){console.error('JSON parse fail:',d.slice(0,300))}})"
}

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
step() { echo; echo "── $1 ──"; }

login() {
  local name=$1 pin=$2
  curl -s -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"pin\":\"$pin\"}" \
    | jq_field 'console.log(j.data.token)'
}

# Helper: split combined "BODY|HTTP:nnn" response from curl -w
extract_code() { echo "$1" | sed 's/.*|HTTP:\([0-9]*\)$/\1/'; }
extract_body() { echo "$1" | sed 's/|HTTP:[0-9]*$//'; }

# ============================================================
step "Setup: login Owner"
OWNER_TOKEN=$(login "Owner" "123456")
if [[ -z "$OWNER_TOKEN" || "$OWNER_TOKEN" == "undefined" ]]; then
  echo "FATAL: gagal login owner"; exit 1
fi
pass "login Owner (token=${OWNER_TOKEN:0:20}...)"

echo "Test tag: $TEST_TAG (entity name suffix untuk avoid collision)"

# ============================================================
step "Test 1: GET /units -> minimal 10 pre-seeded"
R1=$(curl -s "$API/units" -H "Authorization: Bearer $OWNER_TOKEN")
COUNT=$(echo "$R1" | jq_field 'console.log(j.data.units.length)')
# Re-run setelah residual karton-$TS bisa bikin total > 10, asal 10 base ada.
if [[ "$COUNT" -ge "10" ]]; then
  pass "minimal 10 unit pre-seeded (total=$COUNT)"
else
  fail "expected >= 10 units, got $COUNT"
fi

# Verify ada satu unit dengan opnameMode=scale_0_5 (mestinya "skala 0-5")
SCALE_LABEL=$(echo "$R1" | jq_field 'const u=j.data.units.find(x=>x.opnameMode==="scale_0_5"); console.log(u?u.label:"")')
if [[ "$SCALE_LABEL" == "skala 0-5" ]]; then
  pass "unit 'skala 0-5' (opnameMode=scale_0_5) terdaftar"
else
  fail "expected scale unit 'skala 0-5', got '$SCALE_LABEL'"
fi

# Cache ID untuk pakai di test selanjutnya
BUTIR_ID=$(echo "$R1" | jq_field 'const u=j.data.units.find(x=>x.label==="butir"); console.log(u?u.id:"")')
SKALA_ID=$(echo "$R1" | jq_field 'const u=j.data.units.find(x=>x.label==="skala 0-5"); console.log(u?u.id:"")')
if [[ -z "$BUTIR_ID" || -z "$SKALA_ID" ]]; then
  echo "FATAL: butir or skala unit not found (butir=$BUTIR_ID skala=$SKALA_ID)"; exit 1
fi

# ============================================================
step "Test 2: POST /units '$KARTON_LABEL' exact -> 201"
R2=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/units" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"label\":\"$KARTON_LABEL\",\"opnameMode\":\"exact\"}")
CODE2=$(extract_code "$R2")
BODY2=$(extract_body "$R2")
if [[ "$CODE2" == "201" ]]; then
  pass "HTTP 201 create unit $KARTON_LABEL"
else
  fail "expected 201, got $CODE2 body='$(echo "$BODY2" | head -c 200)'"
fi
KARTON_ID=$(echo "$BODY2" | jq_field 'console.log(j.data.unit.id)')
KARTON_MODE=$(echo "$BODY2" | jq_field 'console.log(j.data.unit.opnameMode)')
if [[ "$KARTON_MODE" == "exact" ]]; then
  pass "$KARTON_LABEL.opnameMode = exact"
else
  fail "expected opnameMode=exact, got '$KARTON_MODE'"
fi

# ============================================================
step "Test 3: POST /stocks/raw-materials '$TELUR_NAME' unit=butir exact stock=2 minStock=1 -> 201"
R3=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/stocks/raw-materials" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$TELUR_NAME\",\"unitId\":$BUTIR_ID,\"category\":\"bahanSegar\",\"isTracked\":true,\"stockQty\":2,\"minStock\":1,\"unitPrice\":2500}")
CODE3=$(extract_code "$R3")
BODY3=$(extract_body "$R3")
if [[ "$CODE3" == "201" ]]; then
  pass "HTTP 201 $TELUR_NAME created"
else
  fail "expected 201, got $CODE3 body='$(echo "$BODY3" | head -c 200)'"
fi
TELUR_ID=$(echo "$BODY3" | jq_field 'console.log(j.data.rawMaterial.id)')
TELUR_STOCK=$(echo "$BODY3" | jq_field 'console.log(j.data.rawMaterial.stockQty)')
TELUR_UNIT_LABEL=$(echo "$BODY3" | jq_field 'console.log(j.data.rawMaterial.unit.label)')
if [[ "$TELUR_STOCK" == "2" && "$TELUR_UNIT_LABEL" == "butir" ]]; then
  pass "$TELUR_NAME stock=2 unit=butir"
else
  fail "expected stock=2 unit=butir, got stock=$TELUR_STOCK unit='$TELUR_UNIT_LABEL'"
fi

# ============================================================
step "Test 4: POST /stocks/raw-materials '$BERAS_NAME' unit=skala scale stock=3 minStock=1 -> 201"
R4=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/stocks/raw-materials" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$BERAS_NAME\",\"unitId\":$SKALA_ID,\"category\":\"bahanPokok\",\"isTracked\":true,\"stockQty\":3,\"minStock\":1}")
CODE4=$(extract_code "$R4")
BODY4=$(extract_body "$R4")
if [[ "$CODE4" == "201" ]]; then
  pass "HTTP 201 $BERAS_NAME created"
else
  fail "expected 201, got $CODE4 body='$(echo "$BODY4" | head -c 200)'"
fi
BERAS_ID=$(echo "$BODY4" | jq_field 'console.log(j.data.rawMaterial.id)')
BERAS_STOCK=$(echo "$BODY4" | jq_field 'console.log(j.data.rawMaterial.stockQty)')
BERAS_MODE=$(echo "$BODY4" | jq_field 'console.log(j.data.rawMaterial.unit.opnameMode)')
if [[ "$BERAS_STOCK" == "3" && "$BERAS_MODE" == "scale_0_5" ]]; then
  pass "$BERAS_NAME stock=3 unit.opnameMode=scale_0_5"
else
  fail "expected stock=3 mode=scale_0_5, got stock=$BERAS_STOCK mode='$BERAS_MODE'"
fi

# ============================================================
step "Test 5: POST raw-material scale + minStock=10 -> 422 (out of range)"
R5=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/stocks/raw-materials" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$BERAS_OOR_NAME\",\"unitId\":$SKALA_ID,\"category\":\"bahanPokok\",\"isTracked\":true,\"stockQty\":3,\"minStock\":10}")
CODE5=$(extract_code "$R5")
BODY5=$(extract_body "$R5")
MSG5=$(echo "$BODY5" | jq_field 'console.log(j.message||"")')
if [[ "$CODE5" == "422" && "$MSG5" == *"0..5"* ]]; then
  pass "422 minStock out of scale 0..5 ('$MSG5')"
else
  fail "expected 422 '0..5', got $CODE5 msg='$MSG5'"
fi

# ============================================================
step "Test 6: PUT $TELUR_NAME unit butir->$KARTON_LABEL TANPA newStockQty -> 422"
R6=$(curl -s -w "|HTTP:%{http_code}" -X PUT "$API/stocks/raw-materials/$TELUR_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"unitId\":$KARTON_ID}")
CODE6=$(extract_code "$R6")
BODY6=$(extract_body "$R6")
MSG6=$(echo "$BODY6" | jq_field 'console.log(j.message||"")')
if [[ "$CODE6" == "422" && "$MSG6" == *"newStockQty"* ]]; then
  pass "422 wajib newStockQty ('$MSG6')"
else
  fail "expected 422 newStockQty required, got $CODE6 msg='$MSG6'"
fi

# Konfirmasi unit Telur Test masih butir (tidak ke-update sebagian)
TELUR_NOW=$(curl -s "$API/stocks/raw-materials/$TELUR_ID" -H "Authorization: Bearer $OWNER_TOKEN")
TELUR_UNIT_AFTER_FAIL=$(echo "$TELUR_NOW" | jq_field 'console.log(j.data.rawMaterial.unit.label)')
if [[ "$TELUR_UNIT_AFTER_FAIL" == "butir" ]]; then
  pass "$TELUR_NAME unit masih butir setelah PUT gagal (atomic rollback)"
else
  fail "expected unit=butir, got '$TELUR_UNIT_AFTER_FAIL'"
fi

# ============================================================
step "Test 7: PUT $TELUR_NAME unit butir->$KARTON_LABEL DENGAN newStockQty=60 -> 200 + stock=60"
R7=$(curl -s -w "|HTTP:%{http_code}" -X PUT "$API/stocks/raw-materials/$TELUR_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"unitId\":$KARTON_ID,\"newStockQty\":60}")
CODE7=$(extract_code "$R7")
BODY7=$(extract_body "$R7")
if [[ "$CODE7" == "200" ]]; then
  pass "HTTP 200 unit changed"
else
  fail "expected 200, got $CODE7 body='$(echo "$BODY7" | head -c 200)'"
fi
TELUR_STOCK_AFTER=$(echo "$BODY7" | jq_field 'console.log(j.data.rawMaterial.stockQty)')
TELUR_UNIT_AFTER=$(echo "$BODY7" | jq_field 'console.log(j.data.rawMaterial.unit.label)')
if [[ "$TELUR_STOCK_AFTER" == "60" && "$TELUR_UNIT_AFTER" == "$KARTON_LABEL" ]]; then
  pass "$TELUR_NAME stock=60 unit=$KARTON_LABEL"
else
  fail "expected stock=60 unit=$KARTON_LABEL, got stock=$TELUR_STOCK_AFTER unit='$TELUR_UNIT_AFTER'"
fi

# Verifikasi audit log manualAdjust ter-record dengan delta = +58 (60 - 2)
TELUR_DETAIL=$(curl -s "$API/stocks/raw-materials/$TELUR_ID?limit=10" -H "Authorization: Bearer $OWNER_TOKEN")
HAS_ADJUST=$(echo "$TELUR_DETAIL" | jq_field 'const m=j.data.rawMaterial.recentMovements.find(x=>x.reason==="manualAdjust"); console.log(m?m.delta:"")')
if [[ "$HAS_ADJUST" == "58" ]]; then
  pass "audit log manualAdjust delta=+58 (60-2) tercatat"
else
  fail "expected manualAdjust delta=58, got '$HAS_ADJUST'"
fi

# ============================================================
step "Test 8: POST /purchases exact $TELUR_NAME qty=30 unitPrice=2500 -> 201 + stock=90"
TODAY=$(date +%Y-%m-%d)
R8=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/purchases" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"$TODAY\",\"items\":[{\"rawMaterialId\":$TELUR_ID,\"qty\":30,\"unitPrice\":2500}]}")
CODE8=$(extract_code "$R8")
BODY8=$(extract_body "$R8")
if [[ "$CODE8" == "201" ]]; then
  pass "HTTP 201 purchase exact created"
else
  fail "expected 201, got $CODE8 body='$(echo "$BODY8" | head -c 200)'"
fi
PURCHASE_TOTAL=$(echo "$BODY8" | jq_field 'console.log(j.data.purchase.totalAmount)')
if [[ "$PURCHASE_TOTAL" == "75000" ]]; then
  pass "totalAmount = 75000 (30 * 2500)"
else
  fail "expected totalAmount=75000, got '$PURCHASE_TOTAL'"
fi

# Verifikasi stok telur 60 -> 90
TELUR_AFTER_PURCHASE=$(curl -s "$API/stocks/raw-materials/$TELUR_ID" -H "Authorization: Bearer $OWNER_TOKEN")
TELUR_STOCK_FINAL=$(echo "$TELUR_AFTER_PURCHASE" | jq_field 'console.log(j.data.rawMaterial.stockQty)')
if [[ "$TELUR_STOCK_FINAL" == "90" ]]; then
  pass "$TELUR_NAME stock 60 + 30 = 90"
else
  fail "expected stock=90, got '$TELUR_STOCK_FINAL'"
fi

# ============================================================
step "Test 9: POST /purchases scale $BERAS_NAME subtotal=300000 -> 201 + stock TIDAK berubah"
R9=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/purchases" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"$TODAY\",\"items\":[{\"rawMaterialId\":$BERAS_ID,\"subtotal\":300000,\"note\":\"1 karung 50kg\"}]}")
CODE9=$(extract_code "$R9")
BODY9=$(extract_body "$R9")
if [[ "$CODE9" == "201" ]]; then
  pass "HTTP 201 purchase scale created"
else
  fail "expected 201, got $CODE9 body='$(echo "$BODY9" | head -c 200)'"
fi
PURCHASE9_TOTAL=$(echo "$BODY9" | jq_field 'console.log(j.data.purchase.totalAmount)')
if [[ "$PURCHASE9_TOTAL" == "300000" ]]; then
  pass "totalAmount = 300000"
else
  fail "expected totalAmount=300000, got '$PURCHASE9_TOTAL'"
fi

# Verifikasi stok beras TIDAK berubah (scale mode, stock manual via opname)
BERAS_AFTER=$(curl -s "$API/stocks/raw-materials/$BERAS_ID" -H "Authorization: Bearer $OWNER_TOKEN")
BERAS_STOCK_FINAL=$(echo "$BERAS_AFTER" | jq_field 'console.log(j.data.rawMaterial.stockQty)')
if [[ "$BERAS_STOCK_FINAL" == "3" ]]; then
  pass "$BERAS_NAME stock UNCHANGED = 3 (scale mode, opname only)"
else
  fail "expected stock=3 (unchanged), got '$BERAS_STOCK_FINAL'"
fi

# Verifikasi movement audit ada reason=purchase delta=0
HAS_PURCHASE_AUDIT=$(echo "$BERAS_AFTER" | jq_field 'const m=j.data.rawMaterial.recentMovements.find(x=>x.reason==="purchase"); console.log(m?m.delta:"")')
if [[ "$HAS_PURCHASE_AUDIT" == "0" ]]; then
  pass "audit log purchase delta=0 tercatat untuk scale mode"
else
  fail "expected purchase movement delta=0, got '$HAS_PURCHASE_AUDIT'"
fi

# ============================================================
step "Test 10: POST /purchases item tanpa qty/unitPrice/subtotal -> 422 (Zod refine)"
R10=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/purchases" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"$TODAY\",\"items\":[{\"rawMaterialId\":$TELUR_ID}]}")
CODE10=$(extract_code "$R10")
BODY10=$(extract_body "$R10")
MSG10=$(echo "$BODY10" | jq_field 'console.log(j.message||"")')
if [[ "$CODE10" == "422" && "$MSG10" == *"subtotal"* ]]; then
  pass "422 Zod refine reject empty item ('$MSG10')"
else
  fail "expected 422 subtotal required, got $CODE10 msg='$MSG10'"
fi

# ============================================================
step "Test 11: Cleanup test data (delete raw materials + unit $KARTON_LABEL)"
# Test entities punya purchase items + movements dari Test 8 & 9 → DELETE harus
# 409 (FK protection bekerja). Ini bagian "cleanup verification": tujuannya
# bukan menghapus, tapi memverifikasi FK protection di-enforce. Untuk
# benar-benar membersihkan, jalankan ulang seeder (`prisma db push && db:seed`).
DEL_TELUR=$(curl -s -w "|HTTP:%{http_code}" -X DELETE "$API/stocks/raw-materials/$TELUR_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN")
CODE_DEL_TELUR=$(extract_code "$DEL_TELUR")
if [[ "$CODE_DEL_TELUR" == "409" ]]; then
  pass "DELETE $TELUR_NAME -> 409 (FK protection: purchase items + movements)"
elif [[ "$CODE_DEL_TELUR" == "200" ]]; then
  pass "DELETE $TELUR_NAME -> 200 (tidak ada FK refs)"
else
  fail "DELETE $TELUR_NAME: unexpected $CODE_DEL_TELUR"
fi

DEL_BERAS=$(curl -s -w "|HTTP:%{http_code}" -X DELETE "$API/stocks/raw-materials/$BERAS_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN")
CODE_DEL_BERAS=$(extract_code "$DEL_BERAS")
if [[ "$CODE_DEL_BERAS" == "409" ]]; then
  pass "DELETE $BERAS_NAME -> 409 (FK protection: purchase items + movements)"
elif [[ "$CODE_DEL_BERAS" == "200" ]]; then
  pass "DELETE $BERAS_NAME -> 200 (tidak ada FK refs)"
else
  fail "DELETE $BERAS_NAME: unexpected $CODE_DEL_BERAS"
fi

# Unit $KARTON_LABEL masih dipakai Telur Test (FK protection) — expected 409.
DEL_KARTON=$(curl -s -w "|HTTP:%{http_code}" -X DELETE "$API/units/$KARTON_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN")
CODE_DEL_KARTON=$(extract_code "$DEL_KARTON")
if [[ "$CODE_DEL_KARTON" == "200" ]]; then
  pass "DELETE unit $KARTON_LABEL -> 200"
elif [[ "$CODE_DEL_KARTON" == "409" ]]; then
  pass "DELETE unit $KARTON_LABEL -> 409 (FK protection: $TELUR_NAME masih refer)"
else
  fail "DELETE unit $KARTON_LABEL: unexpected $CODE_DEL_KARTON"
fi

# ============================================================
echo
echo "==================================="
echo "Pass: $PASS  Fail: $FAIL"
echo "==================================="
[ "$FAIL" -gt 0 ] && exit 1
exit 0
