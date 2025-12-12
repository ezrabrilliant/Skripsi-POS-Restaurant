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
        Schema::create('daily_menu_stocks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('date');
            $table->uuid('menu_id');
            $table->integer('stock_start')->default(0);
            $table->integer('stock_sold')->default(0);
            $table->timestamps();

            // Foreign key
            $table->foreign('menu_id')
                ->references('id')
                ->on('menus')
                ->onDelete('cascade');

            // Ensure one record per menu per day
            $table->unique(['date', 'menu_id']);

            // Indexes
            $table->index('date');
            $table->index('menu_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_menu_stocks');
    }
};
