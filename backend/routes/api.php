<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\TableController;
use App\Http\Controllers\Api\SettlementController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes
Route::post('/auth/login', [AuthController::class, 'login']);

// Health check
Route::get('/health', function () {
    return response()->json([
        'success' => true,
        'message' => 'POS Restaurant API is running',
        'timestamp' => now()->toISOString(),
    ]);
});

// Public menu routes (read-only)
Route::get('/menus', [MenuController::class, 'index']);
Route::get('/menus/categories', [MenuController::class, 'categories']);
Route::get('/menus/{id}', [MenuController::class, 'show']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/verify-pin', [AuthController::class, 'verifyPin']);

    // Users (owner only for create/update/delete)
    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{id}', [UserController::class, 'show']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    // Menus (write operations require auth)
    Route::post('/menus', [MenuController::class, 'store']);
    Route::put('/menus/{id}', [MenuController::class, 'update']);
    Route::delete('/menus/{id}', [MenuController::class, 'destroy']);

    // Daily Stocks
    Route::get('/stocks', [StockController::class, 'index']);
    Route::post('/stocks', [StockController::class, 'store']);
    Route::post('/stocks/bulk', [StockController::class, 'bulkStore']);
    Route::put('/stocks/{id}', [StockController::class, 'update']);
    Route::post('/stocks/reset-today', [StockController::class, 'resetToday']);
    Route::post('/stocks/copy-yesterday', [StockController::class, 'copyFromYesterday']);

    // Tables
    Route::get('/tables', [TableController::class, 'index']);
    Route::get('/tables/{tableNumber}', [TableController::class, 'show']);
    Route::get('/tables/{tableNumber}/transaction', [TableController::class, 'getOpenTransaction']);
    Route::post('/tables/{fromTable}/transfer', [TableController::class, 'transfer']);

    // Transactions
    Route::get('/transactions', [TransactionController::class, 'index']);
    Route::get('/transactions/history', [TransactionController::class, 'history']);
    Route::get('/transactions/daily-summary', [TransactionController::class, 'dailySummary']);
    Route::post('/transactions', [TransactionController::class, 'store']);
    Route::get('/transactions/{id}', [TransactionController::class, 'show']);
    Route::put('/transactions/{id}/items', [TransactionController::class, 'syncItems']);
    Route::post('/transactions/{id}/items', [TransactionController::class, 'addItem']);
    Route::put('/transactions/{id}/items/{itemId}', [TransactionController::class, 'updateItem']);
    Route::delete('/transactions/{id}/items/{itemId}', [TransactionController::class, 'removeItem']);
    Route::post('/transactions/{id}/pay', [TransactionController::class, 'pay']);
    Route::post('/transactions/{id}/void', [TransactionController::class, 'void']);

    // Settlements
    Route::get('/settlements', [SettlementController::class, 'index']);
    Route::get('/settlements/preview', [SettlementController::class, 'preview']);
    Route::get('/settlements/calculate/{date}', [SettlementController::class, 'preview']);
    Route::get('/settlements/date/{date}', [SettlementController::class, 'showByDate']);
    Route::get('/settlements/{id}', [SettlementController::class, 'show']);
    Route::post('/settlements', [SettlementController::class, 'store']);
    Route::post('/settlements/{id}/review', [SettlementController::class, 'review']);
});
