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
            $table->foreignUuid('transaction_id')->constrained('transactions')->onDelete('cascade');
            $table->foreignUuid('menu_id')->constrained('menus')->onDelete('restrict');
            $table->string('menu_name', 150);
            $table->integer('quantity');
            $table->decimal('price_at_time', 12, 2);
            $table->decimal('subtotal', 12, 2);
            $table->text('notes')->nullable();
            $table->boolean('is_force_order')->default(false);
            $table->timestamp('created_at')->useCurrent();

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
