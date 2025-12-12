<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyMenuStock extends Model
{
    use HasFactory, HasUuids;

    /**
     * The table associated with the model.
     */
    protected $table = 'daily_menu_stocks';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'date',
        'menu_id',
        'stock_start',
        'stock_sold',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'date' => 'date',
        'stock_start' => 'integer',
        'stock_sold' => 'integer',
    ];

    /**
     * The accessors to append to the model's array form.
     */
    protected $appends = ['stock_remaining'];

    /**
     * Get the menu this stock belongs to
     */
    public function menu(): BelongsTo
    {
        return $this->belongsTo(Menu::class);
    }

    /**
     * Get remaining stock (can be negative for force orders)
     */
    public function getStockRemainingAttribute(): int
    {
        return $this->stock_start - $this->stock_sold;
    }

    /**
     * Check if stock is available
     */
    public function hasStock(): bool
    {
        return $this->stock_remaining > 0;
    }

    /**
     * Decrease stock by quantity
     */
    public function decreaseStock(int $quantity): void
    {
        $this->increment('stock_sold', $quantity);
    }

    /**
     * Increase stock by quantity (for refunds/cancellations)
     */
    public function increaseStock(int $quantity): void
    {
        $this->decrement('stock_sold', $quantity);
    }

    /**
     * Scope for today's stocks
     */
    public function scopeToday($query)
    {
        return $query->where('date', now()->toDateString());
    }

    /**
     * Scope for specific date
     */
    public function scopeForDate($query, $date)
    {
        return $query->where('date', $date);
    }
}
