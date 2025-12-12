<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('transaction_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('transaction_id');
            $table->uuid('menu_id');
            $table->string('menu_name', 150); // Denormalized for historical accuracy
            $table->integer('quantity');
            $table->decimal('price_at_time', 12, 2); // Price snapshot at order time
            $table->decimal('subtotal', 12, 2); // quantity * price_at_time
            $table->text('notes')->nullable(); // Special requests
            $table->boolean('is_force_order')->default(false); // True if ordered when stock was <= 0
            $table->timestamp('created_at')->useCurrent();

            // Foreign keys
            $table->foreign('transaction_id')
                ->references('id')
                ->on('transactions')
                ->onDelete('cascade');

            $table->foreign('menu_id')
                ->references('id')
                ->on('menus')
                ->onDelete('restrict');

            // Indexes
            $table->index('transaction_id');
            $table->index('menu_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transaction_items');
    }
};
