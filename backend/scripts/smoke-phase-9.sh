#!/usr/bin/env bash
# Phase 9 smoke test: dashboard endpoints (owner/cashier/waiter)
set -u

BASE=http://localhost:8000/api

jq_field() {
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d); $1}catch(e){console.error('JSON parse fail:',d.slice(0,300))}})"
}

OWNER_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Owner","pin":"123456"}' | jq_field 'console.log(j.data.token)')
JASON_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Jason","pin":"111111"}' | jq_field 'console.log(j.data.token)')
BRYANT_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Bryant","pin":"111111"}' | jq_field 'console.log(j.data.token)')
AMEL_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"name":"Amel","pin":"222222"}' | jq_field 'console.log(j.data.token)')

echo ""
echo "========== OWNER REPORT =========="
echo ""
echo "=== 1. GET /dashboard/owner (waiter) → 403 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" $BASE/dashboard/owner -H "Authorization: Bearer $AMEL_TOKEN"

echo ""
echo "=== 2. GET /dashboard/owner (kasir) → 403 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" $BASE/dashboard/owner -H "Authorization: Bearer $JASON_TOKEN"

echo ""
echo "=== 3. GET /dashboard/owner period=today (default, owner) → 200 ==="
curl -s "$BASE/dashboard/owner" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const r=j.data.report; console.log(JSON.stringify({period:r.period,revenue:r.revenue,expense:r.expense,profit:r.profit,reminders:r.reminders},null,2))'

echo ""
echo "=== 4. GET /dashboard/owner period=month → 200 dengan rekap bulan ==="
curl -s "$BASE/dashboard/owner?period=month" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const r=j.data.report; console.log(JSON.stringify({periodLabel:r.period.label,from:r.period.fromDate,to:r.period.toDate,revenue:r.revenue.total,txCount:r.revenue.transactionCount,purchase:r.expense.purchaseTotal,bill:r.expense.billTotal,profit:r.profit,reminders:r.reminders},null,2))'

echo ""
echo "=== 5. GET /dashboard/owner period=custom (3 day window) → 200 ==="
curl -s "$BASE/dashboard/owner?period=custom&fromDate=2026-05-22&toDate=2026-05-24" -H "Authorization: Bearer $OWNER_TOKEN" | jq_field 'const r=j.data.report; console.log("custom period:", r.period.label, "revenue:", r.revenue.total, "profit:", r.profit)'

echo ""
echo "=== 6. Validation: period=custom tanpa fromDate → 422 ==="
curl -s "$BASE/dashboard/owner?period=custom" -H "Authorization: Bearer $OWNER_TOKEN" | head -c 200; echo

echo ""
echo "========== CASHIER DASHBOARD =========="
echo ""
echo "=== 7. GET /dashboard/cashier (waiter) → 403 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" $BASE/dashboard/cashier -H "Authorization: Bearer $AMEL_TOKEN"

echo ""
echo "=== 8. GET /dashboard/cashier (Jason kasir — pagi shift closed earlier) → 200, activeShift=null ==="
curl -s $BASE/dashboard/cashier -H "Authorization: Bearer $JASON_TOKEN" | jq_field 'const d=j.data.dashboard; console.log(JSON.stringify({activeShift:d.activeShift,today:d.today,reminders:d.reminders},null,2))'

echo ""
echo "=== 9. Open shift baru untuk Jason, lalu GET /dashboard/cashier — activeShift terisi ==="
NEW_SHIFT=$(curl -s -X POST $BASE/shifts/open -H "Content-Type: application/json" -H "Authorization: Bearer $BRYANT_TOKEN" -d '{"type":"malam","openingCash":200000}' 2>&1)
echo "$NEW_SHIFT" | head -c 200; echo
NEW_SHIFT_ID=$(echo "$NEW_SHIFT" | jq_field 'console.log(j.data?.shift?.id || "EXISTING")')

if [ "$NEW_SHIFT_ID" = "EXISTING" ] || [ -z "$NEW_SHIFT_ID" ]; then
  echo "  (Bryant malam shift sudah ada — skip new open)"
else
  echo "  Bryant new malam shift id=$NEW_SHIFT_ID"
fi
echo ""
echo "Bryant /dashboard/cashier:"
curl -s $BASE/dashboard/cashier -H "Authorization: Bearer $BRYANT_TOKEN" | jq_field 'const d=j.data.dashboard; console.log(JSON.stringify({activeShift:d.activeShift,today:d.today,reminders:d.reminders},null,2))'

echo ""
echo "=== 10. GET /dashboard/cashier (owner — also allowed) → 200 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" $BASE/dashboard/cashier -H "Authorization: Bearer $OWNER_TOKEN"

echo ""
echo "========== WAITER DASHBOARD =========="
echo ""
echo "=== 11. GET /dashboard/waiter (waiter Amel) → 200 ==="
curl -s $BASE/dashboard/waiter -H "Authorization: Bearer $AMEL_TOKEN" | jq_field 'const d=j.data.dashboard; console.log(JSON.stringify({portionStocks:{totalCount:d.portionStocks.totalCount,lowCount:d.portionStocks.lowCount,top3LowSamples:d.portionStocks.lowSamples.slice(0,3)},rawMaterials:{lowCount:d.rawMaterials.lowCount,nearExpiryCount:d.rawMaterials.nearExpiryCount,top3LowSamples:d.rawMaterials.lowSamples.slice(0,3)},activeShiftsToday:d.activeShiftsToday},null,2))'

echo ""
echo "=== 12. GET /dashboard/waiter (owner — also allowed) → 200 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" $BASE/dashboard/waiter -H "Authorization: Bearer $OWNER_TOKEN"

echo ""
echo "=== 13. GET /dashboard/waiter (kasir) → 200 ==="
curl -s -o /dev/null -w "status=%{http_code}\n" $BASE/dashboard/waiter -H "Authorization: Bearer $JASON_TOKEN"

echo ""
echo "=== 14. No auth → 401 ==="
curl -s -o /dev/null -w "owner=%{http_code} cashier=" $BASE/dashboard/owner
curl -s -o /dev/null -w "%{http_code} waiter=" $BASE/dashboard/cashier
curl -s -o /dev/null -w "%{http_code}\n" $BASE/dashboard/waiter
