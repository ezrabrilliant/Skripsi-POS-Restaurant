#!/usr/bin/env bash
# Phase 3 smoke test — shift-decoupling refactor.
# Verifikasi:
#   - GET /api/shifts/active return array { shifts: [...] }
#   - POST /api/transactions auto-resolve shift dari single active
#   - 0 active -> 409
#   - 2+ active -> 409
#   - Response shape pakai createdById/createdByName/shiftCashierName
#
# Pre-req: backend running di :8000, DB fresh (`prisma db push --force-reset && db:seed`).
# Run: bash backend/scripts/smoke-shift-decoupling.sh
# Aman dihapus setelah Phase 3 review.

set -u

API="http://localhost:8000/api"
PASS=0
FAIL=0

# Node-based jq replacement (mengikuti pattern smoke-phase-4a.sh existing).
jq_field() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d); $1}catch(e){console.error('JSON parse fail:',d.slice(0,200))}})"
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

# ============================================================
step "Setup: login Jason / Bryant / Owner / Amel"
JASON_TOKEN=$(login "Jason" "111111")
BRYANT_TOKEN=$(login "Bryant" "111111")
OWNER_TOKEN=$(login "Owner" "123456")
AMEL_TOKEN=$(login "Amel" "222222")
[[ -n "$JASON_TOKEN" ]] && pass "login Jason (token=${JASON_TOKEN:0:20}...)" || fail "login Jason"
[[ -n "$BRYANT_TOKEN" ]] && pass "login Bryant" || fail "login Bryant"
[[ -n "$OWNER_TOKEN" ]] && pass "login Owner" || fail "login Owner"
[[ -n "$AMEL_TOKEN" ]] && pass "login Amel" || fail "login Amel"

# ============================================================
step "Test 1: GET /shifts/active baseline (0 shift) -> { shifts: [] }"
R1=$(curl -s "$API/shifts/active" -H "Authorization: Bearer $JASON_TOKEN")
LEN1=$(echo "$R1" | jq_field 'console.log(j.data.shifts.length)')
MSG1=$(echo "$R1" | jq_field 'console.log(j.message)')
if [[ "$LEN1" == "0" && "$MSG1" == "Tidak ada shift aktif" ]]; then
  pass "shifts=[], message='Tidak ada shift aktif'"
else
  fail "expected length=0 'Tidak ada shift aktif', got length=$LEN1 msg='$MSG1'"
fi

# ============================================================
step "Test 2: POST /transactions tanpa shift aktif -> 409"
R2=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/transactions" \
  -H "Authorization: Bearer $JASON_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderType":"takeaway","items":[{"menuId":1,"qty":1}]}')
CODE2=$(echo "$R2" | sed 's/.*|HTTP:\([0-9]*\)$/\1/')
BODY2=$(echo "$R2" | sed 's/|HTTP:[0-9]*$//')
MSG2=$(echo "$BODY2" | jq_field 'console.log(j.message)')
if [[ "$CODE2" == "409" && "$MSG2" == *"Belum ada shift kasir aktif"* ]]; then
  pass "409 '$MSG2'"
else
  fail "expected 409 'Belum ada shift kasir aktif', got $CODE2 msg='$MSG2'"
fi

# ============================================================
step "Setup: Jason buka shift pagi (modal 500000)"
SHIFT_J=$(curl -s -X POST "$API/shifts/open" \
  -H "Authorization: Bearer $JASON_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"pagi","openingCash":500000}')
JASON_SHIFT_ID=$(echo "$SHIFT_J" | jq_field 'console.log(j.data.shift.id)')
[[ -n "$JASON_SHIFT_ID" ]] && pass "shift Jason created id=$JASON_SHIFT_ID" || { fail "buka shift Jason"; echo "$SHIFT_J"; }

# ============================================================
step "Test 3: GET /shifts/active (1 shift) -> length=1 + cashierName='Jason'"
R3=$(curl -s "$API/shifts/active" -H "Authorization: Bearer $JASON_TOKEN")
LEN3=$(echo "$R3" | jq_field 'console.log(j.data.shifts.length)')
NAME3=$(echo "$R3" | jq_field 'console.log(j.data.shifts[0].cashierName)')
MSG3=$(echo "$R3" | jq_field 'console.log(j.message)')
if [[ "$LEN3" == "1" && "$NAME3" == "Jason" && "$MSG3" == "Satu shift aktif" ]]; then
  pass "length=1, cashierName=Jason, 'Satu shift aktif'"
else
  fail "expected length=1 Jason 'Satu shift aktif', got length=$LEN3 name=$NAME3 msg='$MSG3'"
fi

# ============================================================
step "Test 4: POST /transactions Jason takeaway 1x Paha Bakar -> 201"
MENUS=$(curl -s "$API/menus" -H "Authorization: Bearer $JASON_TOKEN")
PAHA_BAKAR_ID=$(echo "$MENUS" | jq_field 'const m=j.data.menus.find(x=>x.name==="Paha Ayam Bakar"); console.log(m?m.id:"")')
AIR_ID=$(echo "$MENUS" | jq_field 'const m=j.data.menus.find(x=>x.name==="Air Mineral"); console.log(m?m.id:"")')
[[ -n "$PAHA_BAKAR_ID" ]] && pass "menu Paha Bakar id=$PAHA_BAKAR_ID" || fail "menu Paha Bakar not found"
[[ -n "$AIR_ID" ]] && pass "menu Air Mineral id=$AIR_ID" || fail "menu Air Mineral not found"

R4=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/transactions" \
  -H "Authorization: Bearer $JASON_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$PAHA_BAKAR_ID,\"qty\":1}]}")
CODE4=$(echo "$R4" | sed 's/.*|HTTP:\([0-9]*\)$/\1/')
BODY4=$(echo "$R4" | sed 's/|HTTP:[0-9]*$//')
if [[ "$CODE4" == "201" ]]; then
  CREATED_BY_NAME=$(echo "$BODY4" | jq_field 'console.log(j.data.transaction.createdByName)')
  SHIFT_CASHIER_NAME=$(echo "$BODY4" | jq_field 'console.log(j.data.transaction.shiftCashierName)')
  SHIFT_ID=$(echo "$BODY4" | jq_field 'console.log(j.data.transaction.shiftId)')
  if [[ "$CREATED_BY_NAME" == "Jason" && "$SHIFT_CASHIER_NAME" == "Jason" && "$SHIFT_ID" == "$JASON_SHIFT_ID" ]]; then
    pass "tx createdByName=Jason shiftCashierName=Jason shiftId=$JASON_SHIFT_ID (auto-resolved)"
  else
    fail "field salah: createdByName=$CREATED_BY_NAME shiftCashierName=$SHIFT_CASHIER_NAME shiftId=$SHIFT_ID"
    echo "$BODY4"
  fi
else
  fail "POST tx expected 201, got $CODE4"
  echo "$BODY4"
fi

# ============================================================
step "Test 5: Owner numpang shift Jason -> 201 dengan createdByName=Owner, shiftCashierName=Jason"
R5=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/transactions" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$AIR_ID,\"qty\":1}]}")
CODE5=$(echo "$R5" | sed 's/.*|HTTP:\([0-9]*\)$/\1/')
BODY5=$(echo "$R5" | sed 's/|HTTP:[0-9]*$//')
if [[ "$CODE5" == "201" ]]; then
  C5_NAME=$(echo "$BODY5" | jq_field 'console.log(j.data.transaction.createdByName)')
  C5_SHIFT_CASHIER=$(echo "$BODY5" | jq_field 'console.log(j.data.transaction.shiftCashierName)')
  if [[ "$C5_NAME" == "Owner" && "$C5_SHIFT_CASHIER" == "Jason" ]]; then
    pass "Owner tx createdByName=Owner shiftCashierName=Jason (numpang)"
  else
    fail "field salah: createdByName=$C5_NAME shiftCashierName=$C5_SHIFT_CASHIER"
  fi
else
  fail "Owner POST tx expected 201, got $CODE5"
  echo "$BODY5"
fi

# ============================================================
step "Test 6: Waiter Amel fallback input -> 201 (per matrix REV 2.3)"
R6=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/transactions" \
  -H "Authorization: Bearer $AMEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$AIR_ID,\"qty\":1}]}")
CODE6=$(echo "$R6" | sed 's/.*|HTTP:\([0-9]*\)$/\1/')
BODY6=$(echo "$R6" | sed 's/|HTTP:[0-9]*$//')
if [[ "$CODE6" == "201" ]]; then
  C6_NAME=$(echo "$BODY6" | jq_field 'console.log(j.data.transaction.createdByName)')
  if [[ "$C6_NAME" == "Amel" ]]; then
    pass "Amel (waiter) fallback tx OK, createdByName=Amel"
  else
    fail "Amel tx createdByName=$C6_NAME (expected Amel)"
  fi
else
  fail "Amel POST tx expected 201, got $CODE6"
fi

# ============================================================
step "Test 7 (REV 2.5): Bryant coba buka shift PAGI (tipe sama, sudah ada Jason) -> 409"
SHIFT_DUPL=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/shifts/open" \
  -H "Authorization: Bearer $BRYANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"pagi","openingCash":250000}')
CODE7=$(echo "$SHIFT_DUPL" | sed 's/.*|HTTP:\([0-9]*\)$/\1/')
BODY7=$(echo "$SHIFT_DUPL" | sed 's/|HTTP:[0-9]*$//')
MSG7=$(echo "$BODY7" | jq_field 'console.log(j.message)')
if [[ "$CODE7" == "409" && "$MSG7" == *"sudah dibuka oleh Jason"* ]]; then
  pass "409 '$MSG7'"
else
  fail "expected 409 'sudah dibuka oleh Jason', got $CODE7 msg='$MSG7'"
fi

# ============================================================
step "Test 7b (REV 2.5): Bryant buka shift MALAM (beda tipe, transisi valid) -> 201"
SHIFT_B=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/shifts/open" \
  -H "Authorization: Bearer $BRYANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"malam","openingCash":300000}')
CODE7B=$(echo "$SHIFT_B" | sed 's/.*|HTTP:\([0-9]*\)$/\1/')
BODY7B=$(echo "$SHIFT_B" | sed 's/|HTTP:[0-9]*$//')
BRYANT_SHIFT_ID=$(echo "$BODY7B" | jq_field 'console.log(j.data.shift.id)')
if [[ "$CODE7B" == "201" && -n "$BRYANT_SHIFT_ID" ]]; then
  pass "Bryant shift malam id=$BRYANT_SHIFT_ID (transisi pagi->malam OK, beda tipe)"
else
  fail "Bryant buka shift malam expected 201, got $CODE7B"
  echo "$BODY7B"
fi

# ============================================================
step "Test 8: GET /shifts/active 2 shift beda tipe -> length=2, message adaptive"
R8=$(curl -s "$API/shifts/active" -H "Authorization: Bearer $JASON_TOKEN")
LEN8=$(echo "$R8" | jq_field 'console.log(j.data.shifts.length)')
MSG8=$(echo "$R8" | jq_field 'console.log(j.message)')
if [[ "$LEN8" == "2" ]]; then
  pass "length=2, message='$MSG8'"
else
  fail "expected length=2, got length=$LEN8 msg='$MSG8'"
fi

# ============================================================
step "Test 9 (REV 2.5): POST /transactions dengan 2 shift beda tipe -> 201 auto-resolve via jam"
R9=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/transactions" \
  -H "Authorization: Bearer $JASON_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$AIR_ID,\"qty\":1}]}")
CODE9=$(echo "$R9" | sed 's/.*|HTTP:\([0-9]*\)$/\1/')
BODY9=$(echo "$R9" | sed 's/|HTTP:[0-9]*$//')
if [[ "$CODE9" == "201" ]]; then
  # Cek shiftCashierName resolved via jam server.
  # Jam < 18 -> pagi (Jason). Jam >= 18 -> malam (Bryant).
  HOUR=$(date +%H)
  RESOLVED_CASHIER=$(echo "$BODY9" | jq_field 'console.log(j.data.transaction.shiftCashierName)')
  if [[ "$HOUR" -ge 18 ]]; then
    EXPECTED="Bryant"
  else
    EXPECTED="Jason"
  fi
  if [[ "$RESOLVED_CASHIER" == "$EXPECTED" ]]; then
    pass "201 auto-resolved: jam=$HOUR shiftCashierName=$RESOLVED_CASHIER (expected $EXPECTED)"
  else
    fail "auto-resolve mismatch: jam=$HOUR shiftCashierName=$RESOLVED_CASHIER (expected $EXPECTED)"
  fi
else
  MSG9=$(echo "$BODY9" | jq_field 'console.log(j.message)')
  fail "expected 201 auto-resolve, got $CODE9 msg='$MSG9'"
fi

# ============================================================
step "Test 10: Tutup shift Jason -> sukses, balik ke single active = Bryant"
R10=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/shifts/$JASON_SHIFT_ID/close" \
  -H "Authorization: Bearer $JASON_TOKEN")
CODE10=$(echo "$R10" | sed 's/.*|HTTP:\([0-9]*\)$/\1/')
[[ "$CODE10" == "200" ]] && pass "Jason shift closed" || fail "Jason close shift expected 200, got $CODE10"

R10B=$(curl -s "$API/shifts/active" -H "Authorization: Bearer $JASON_TOKEN")
LEN10B=$(echo "$R10B" | jq_field 'console.log(j.data.shifts.length)')
NAME10B=$(echo "$R10B" | jq_field 'console.log(j.data.shifts[0].cashierName)')
if [[ "$LEN10B" == "1" && "$NAME10B" == "Bryant" ]]; then
  pass "after close Jason: length=1, cashierName=Bryant"
else
  fail "expected length=1 Bryant, got length=$LEN10B name=$NAME10B"
fi

# ============================================================
step "Test 11: POST /transactions setelah single active resolved (Bryant) -> 201 shiftCashierName=Bryant"
R11=$(curl -s -w "|HTTP:%{http_code}" -X POST "$API/transactions" \
  -H "Authorization: Bearer $JASON_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderType\":\"takeaway\",\"items\":[{\"menuId\":$AIR_ID,\"qty\":1}]}")
CODE11=$(echo "$R11" | sed 's/.*|HTTP:\([0-9]*\)$/\1/')
BODY11=$(echo "$R11" | sed 's/|HTTP:[0-9]*$//')
if [[ "$CODE11" == "201" ]]; then
  C11_BY=$(echo "$BODY11" | jq_field 'console.log(j.data.transaction.createdByName)')
  C11_SHIFT_CASH=$(echo "$BODY11" | jq_field 'console.log(j.data.transaction.shiftCashierName)')
  C11_SHIFT_ID=$(echo "$BODY11" | jq_field 'console.log(j.data.transaction.shiftId)')
  if [[ "$C11_BY" == "Jason" && "$C11_SHIFT_CASH" == "Bryant" && "$C11_SHIFT_ID" == "$BRYANT_SHIFT_ID" ]]; then
    pass "Jason input tx ke shift Bryant: createdByName=Jason shiftCashierName=Bryant"
  else
    fail "field salah: createdByName=$C11_BY shiftCashierName=$C11_SHIFT_CASH (expected Jason/Bryant)"
  fi
else
  fail "POST tx expected 201, got $CODE11"
  echo "$BODY11"
fi

# ============================================================
echo
echo "════════════════════════════════════════"
echo "Smoke test selesai: $PASS pass, $FAIL fail"
echo "════════════════════════════════════════"
exit $FAIL
