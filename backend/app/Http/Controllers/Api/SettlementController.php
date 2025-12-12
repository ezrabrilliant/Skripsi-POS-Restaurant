<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Settlement;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SettlementController extends Controller
{
    /**
     * Get all settlements
     */
    public function index(Request $request): JsonResponse
    {
        $query = Settlement::with('cashier');

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by date range
        if ($request->has('start_date')) {
            $query->where('date', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->where('date', '<=', $request->end_date);
        }

        $settlements = $query->orderBy('date', 'desc')
            ->paginate($request->get('per_page', 30));

        return response()->json([
            'success' => true,
            'data' => $settlements->items(),
            'meta' => [
                'current_page' => $settlements->currentPage(),
                'last_page' => $settlements->lastPage(),
                'per_page' => $settlements->perPage(),
                'total' => $settlements->total(),
            ],
        ]);
    }

    /**
     * Get single settlement
     */
    public function show(string $id): JsonResponse
    {
        $settlement = Settlement::with('cashier')->find($id);

        if (!$settlement) {
            return response()->json([
                'success' => false,
                'message' => 'Settlement tidak ditemukan',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $settlement,
        ]);
    }

    /**
     * Get settlement by date
     */
    public function showByDate(string $date): JsonResponse
    {
        $settlement = Settlement::with('cashier')
            ->where('date', $date)
            ->first();

        if (!$settlement) {
            // Return system totals for the date
            $systemTotals = Settlement::calculateSystemTotals($date);

            return response()->json([
                'success' => true,
                'data' => [
                    'date' => $date,
                    'status' => 'not_created',
                    ...$systemTotals,
                ],
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $settlement,
        ]);
    }

    /**
     * Create or update settlement for a date
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'date' => 'required|date',
            'actual_cash' => 'required|numeric|min:0',
            'actual_edc' => 'required|numeric|min:0',
            'actual_transfer' => 'required|numeric|min:0',
            'variance_reason' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Check if there are open transactions for the date
        $openTransactions = Transaction::where('status', 'open')
            ->whereDate('created_at', $request->date)
            ->count();

        if ($openTransactions > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Masih ada ' . $openTransactions . ' transaksi yang belum dibayar',
            ], 400);
        }

        // Calculate system totals
        $systemTotals = Settlement::calculateSystemTotals($request->date);

        // Check if settlement already exists for this date
        $settlement = Settlement::where('date', $request->date)->first();

        if ($settlement) {
            // Update existing
            $settlement->update([
                'cashier_id' => $request->user()->id,
                ...$systemTotals,
                'actual_cash' => $request->actual_cash,
                'actual_edc' => $request->actual_edc,
                'actual_transfer' => $request->actual_transfer,
                'variance_reason' => $request->variance_reason,
                'notes' => $request->notes,
                'status' => 'submitted',
            ]);
        } else {
            // Create new
            $settlement = Settlement::create([
                'date' => $request->date,
                'cashier_id' => $request->user()->id,
                ...$systemTotals,
                'actual_cash' => $request->actual_cash,
                'actual_edc' => $request->actual_edc,
                'actual_transfer' => $request->actual_transfer,
                'variance_reason' => $request->variance_reason,
                'notes' => $request->notes,
                'status' => 'submitted',
            ]);
        }

        // Check if variance reason is required
        if ($settlement->hasVariance() && empty($settlement->variance_reason)) {
            return response()->json([
                'success' => false,
                'message' => 'Alasan selisih wajib diisi jika ada variance',
                'data' => $settlement,
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Settlement berhasil disimpan',
            'data' => $settlement->load('cashier'),
        ], 201);
    }

    /**
     * Review settlement (owner only)
     */
    public function review(Request $request, string $id): JsonResponse
    {
        $settlement = Settlement::find($id);

        if (!$settlement) {
            return response()->json([
                'success' => false,
                'message' => 'Settlement tidak ditemukan',
            ], 404);
        }

        if ($settlement->status !== 'submitted') {
            return response()->json([
                'success' => false,
                'message' => 'Settlement belum disubmit atau sudah direview',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $settlement->status = 'reviewed';
        if ($request->has('notes')) {
            $settlement->notes = $request->notes;
        }
        $settlement->save();

        return response()->json([
            'success' => true,
            'message' => 'Settlement berhasil direview',
            'data' => $settlement->load('cashier'),
        ]);
    }

    /**
     * Get today's settlement preview (without saving)
     */
    public function preview(): JsonResponse
    {
        $date = now()->toDateString();
        $systemTotals = Settlement::calculateSystemTotals($date);

        // Check for open transactions
        $openTransactions = Transaction::where('status', 'open')
            ->whereDate('created_at', $date)
            ->count();

        // Get transactions summary
        $transactions = Transaction::where('status', 'paid')
            ->whereDate('paid_at', $date)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'date' => $date,
                ...$systemTotals,
                'open_transactions' => $openTransactions,
                'total_transactions' => $transactions->count(),
                'transactions_by_method' => [
                    'cash' => $transactions->where('payment_method', 'cash')->count(),
                    'edc_bca' => $transactions->where('payment_method', 'edc_bca')->count(),
                    'edc_mandiri' => $transactions->where('payment_method', 'edc_mandiri')->count(),
                    'qris' => $transactions->where('payment_method', 'qris')->count(),
                    'transfer' => $transactions->where('payment_method', 'transfer')->count(),
                ],
            ],
        ]);
    }
}
