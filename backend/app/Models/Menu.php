<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Menu extends Model
{
    use HasFactory, HasUuids;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'price',
        'category',
        'description',
        'is_active',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'price' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    /**
     * Get daily stocks for this menu
     */
    public function dailyStocks(): HasMany
    {
        return $this->hasMany(DailyMenuStock::class);
    }

    /**
     * Get transaction items for this menu
     */
    public function transactionItems(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    /**
     * Get today's stock for this menu
     */
    public function getTodayStock()
    {
        return $this->dailyStocks()
            ->where('date', now()->toDateString())
            ->first();
    }

    /**
     * Get stock remaining for today
     */
    public function getStockRemainingAttribute(): int
    {
        $todayStock = $this->getTodayStock();
        
        if (!$todayStock) {
            return 0;
        }

        return $todayStock->stock_start - $todayStock->stock_sold;
    }

    /**
     * Scope for active menus
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope for filtering by category
     */
    public function scopeByCategory($query, string $category)
    {
        return $query->where('category', $category);
    }
}
