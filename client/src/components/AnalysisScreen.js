import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function AnalysisScreen() {
  const [costAnalysis, setCostAnalysis] = useState(null);
  const [supplierAnalysis, setSupplierAnalysis] = useState([]);
  const [unitAnalysis, setUnitAnalysis] = useState([]);
  const [dateAnalysis, setDateAnalysis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAnalysisData();
  }, []);

  const loadAnalysisData = async () => {
    setLoading(true);
    try {
      const [costs, suppliers, units, dates] = await Promise.all([
        axios.get('/api/analysis/costs'),
        axios.get('/api/analysis/suppliers'),
        axios.get('/api/analysis/units'),
        axios.get('/api/analysis/dates')
      ]);

      setCostAnalysis(costs.data);
      setSupplierAnalysis(suppliers.data);
      setUnitAnalysis(units.data);
      setDateAnalysis(dates.data);
    } catch (err) {
      setError('Error loading analysis data');
      console.error('Error loading analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };


  if (loading) {
    return <div className="loading">Loading analysis data...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  // Check if we have data but all costs are zero
  const hasDataButNoCosts = costAnalysis && costAnalysis.total_repairs > 0 && costAnalysis.total_cost === 0;

  return (
    <div>
      {hasDataButNoCosts && (
        <div className="card" style={{ backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', marginBottom: '20px' }}>
          <h3>📊 Data Available - Costs Needed</h3>
          <p>You have <strong>{costAnalysis.total_repairs} repair items</strong> in your database, but no cost estimates have been entered yet.</p>
          <p>To see meaningful analysis, please go to the <strong>Units</strong> view and enter cost estimates for your repair items.</p>
        </div>
      )}
      
      {/* Cost Overview */}
      <div className="analysis-grid">
        <div className="analysis-card">
          <h3>Total Cost</h3>
          <div className="analysis-value">{formatCurrency(costAnalysis?.total_cost)}</div>
          <div className="analysis-label">All Repairs</div>
        </div>
        
        <div className="analysis-card">
          <h3>Average Cost</h3>
          <div className="analysis-value">{formatCurrency(costAnalysis?.average_cost)}</div>
          <div className="analysis-label">Per Repair</div>
        </div>
        
        <div className="analysis-card">
          <h3>Total Repairs</h3>
          <div className="analysis-value">{costAnalysis?.total_repairs}</div>
          <div className="analysis-label">Items</div>
        </div>
        
        <div className="analysis-card">
          <h3>High Priority Cost</h3>
          <div className="analysis-value">{formatCurrency(costAnalysis?.high_priority_cost)}</div>
          <div className="analysis-label">Priority 8+</div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Supplier Analysis */}
        <div className="card">
          <h2>Cost by Supplier</h2>
          {supplierAnalysis.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={supplierAnalysis.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="supplier" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(value), 'Total Cost']} />
                <Bar dataKey="total_cost" fill="#667eea" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
              No supplier data available
            </p>
          )}
        </div>

        {/* Unit Analysis */}
        <div className="card">
          <h2>Cost by Unit</h2>
          {unitAnalysis.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={unitAnalysis.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="address_number" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(value), 'Total Cost']} />
                <Bar dataKey="total_cost" fill="#764ba2" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
              No unit data available
            </p>
          )}
        </div>
      </div>

      {/* Detailed Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Supplier Details */}
        <div className="card">
          <h2>Supplier Breakdown</h2>
          {supplierAnalysis.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Repairs</th>
                    <th>Total Cost</th>
                    <th>Avg Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierAnalysis.map((supplier, index) => (
                    <tr key={index}>
                      <td>{supplier.supplier}</td>
                      <td>{supplier.repair_count}</td>
                      <td className="cost">{formatCurrency(supplier.total_cost)}</td>
                      <td>{formatCurrency(supplier.average_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
              No supplier data available
            </p>
          )}
        </div>

        {/* Unit Details */}
        <div className="card">
          <h2>Unit Breakdown</h2>
          {unitAnalysis.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Repairs</th>
                    <th>Total Cost</th>
                    <th>Avg Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {unitAnalysis.map((unit, index) => (
                    <tr key={index}>
                      <td>{unit.address_number} {unit.address_street}</td>
                      <td>{unit.repair_count}</td>
                      <td className="cost">{formatCurrency(unit.total_cost)}</td>
                      <td>{unit.average_priority?.toFixed(1) || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
              No unit data available
            </p>
          )}
        </div>
      </div>

      {/* Date Analysis */}
      {dateAnalysis.length > 0 && (
        <div className="card">
          <h2>Completion Schedule</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Completion Date</th>
                  <th>Repairs</th>
                  <th>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {dateAnalysis.map((date, index) => (
                  <tr key={index}>
                    <td>{date.completion_date}</td>
                    <td>{date.repair_count}</td>
                    <td className="cost">{formatCurrency(date.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!costAnalysis && (
        <div className="card">
          <h2>No Data Available</h2>
          <p>Please upload and save repair data first to view analysis.</p>
        </div>
      )}
    </div>
  );
}

export default AnalysisScreen;

