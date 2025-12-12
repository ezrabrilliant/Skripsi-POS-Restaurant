<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransactionItem extends Model
{
    use HasFactory, HasUuids;

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'transaction_id',
        'menu_id',
        'menu_name',
        'quantity',
        'price_at_time',
        'subtotal',
        'notes',
        'is_force_order',
        'created_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'quantity' => 'integer',
        'price_at_time' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'is_force_order' => 'boolean',
        'created_at' => 'datetime',
    ];

    /**
     * Get the transaction this item belongs to
     */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /**
     * Get the menu for this item
     */
    public function menu(): BelongsTo
    {
        return $this->belongsTo(Menu::class);
    }

    /**
     * Calculate and set subtotal
     */
    public function calculateSubtotal(): void
    {
        $this->subtotal = $this->quantity * $this->price_at_time;
    }

    /**
     * Boot function
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($item) {
            $item->subtotal = $item->quantity * $item->price_at_time;
            $item->created_at = now();
        });

        static::created(function ($item) {
            // Update transaction totals
            $item->transaction->calculateTotals();

            // Update stock
            $dailyStock = DailyMenuStock::where('menu_id', $item->menu_id)
                ->where('date', now()->toDateString())
                ->first();

            if ($dailyStock) {
                $dailyStock->decreaseStock($item->quantity);
            }
        });
    }
}
