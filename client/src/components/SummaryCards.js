import React from 'react';

function SummaryCards({ summary }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="summary-grid">
      <div className="summary-card">
        <h3>{summary.total_repairs}</h3>
        <p>Total Repairs</p>
      </div>
      
      <div className="summary-card">
        <h3>{formatCurrency(summary.total_estimated_cost)}</h3>
        <p>Total Estimated Cost</p>
      </div>
      
      <div className="summary-card">
        <h3>{summary.critical_repairs}</h3>
        <p>Critical Repairs</p>
      </div>
      
      <div className="summary-card">
        <h3>{summary.high_priority_repairs}</h3>
        <p>High Priority Repairs</p>
      </div>
    </div>
  );
}

export default SummaryCards;

