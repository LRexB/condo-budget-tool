import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function DatabaseScreen() {
  const [databaseData, setDatabaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDatabaseData();
  }, []);

  const loadDatabaseData = async () => {
    setLoading(true);
    try {
      const [costs, suppliers, units, repairTypes] = await Promise.all([
        axios.get('/api/analysis/costs'),
        axios.get('/api/analysis/suppliers'),
        axios.get('/api/analysis/units'),
        axios.get('/api/analysis/repair-types')
      ]);

      setDatabaseData({
        costs: costs.data,
        suppliers: suppliers.data,
        units: units.data,
        repairTypes: repairTypes.data
      });
    } catch (err) {
      setError('Error loading database data');
      console.error('Error loading database:', err);
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
    return <div className="loading">Loading database data...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (!databaseData) {
    return (
      <div className="card">
        <h2>No Database Data</h2>
        <p>Please upload and save repair data first to view database information.</p>
        <button className="btn" onClick={loadDatabaseData}>
          Refresh Data
        </button>
      </div>
    );
  }

  // Check if we have data but all costs are zero
  const hasDataButNoCosts = databaseData.costs && databaseData.costs.total_repairs > 0 && databaseData.costs.total_cost === 0;

  return (
    <div>
      {hasDataButNoCosts && (
        <div className="card" style={{ backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', marginBottom: '20px' }}>
          <h3>📊 Data Available - Costs Needed</h3>
          <p>You have <strong>{databaseData.costs.total_repairs} repair items</strong> in your database, but no cost estimates have been entered yet.</p>
          <p>To see meaningful analysis, please go to the <strong>Units</strong> view and enter cost estimates for your repair items.</p>
        </div>
      )}
      
      {/* Grand Total Overview */}
      <div className="analysis-grid">
        <div className="analysis-card">
          <h3>Grand Total Cost</h3>
          <div className="analysis-value">{formatCurrency(databaseData.costs?.total_cost)}</div>
          <div className="analysis-label">All Repairs Combined</div>
        </div>
        
        <div className="analysis-card">
          <h3>Average Cost per Unit</h3>
          <div className="analysis-value">{formatCurrency(databaseData.costs?.total_cost / (databaseData.units?.length || 1))}</div>
          <div className="analysis-label">Per Unit Average</div>
        </div>
        
        <div className="analysis-card">
          <h3>Total Units</h3>
          <div className="analysis-value">{databaseData.units?.length || 0}</div>
          <div className="analysis-label">Units in Database</div>
        </div>
        
        <div className="analysis-card">
          <h3>Total Repairs</h3>
          <div className="analysis-value">{databaseData.costs?.total_repairs || 0}</div>
          <div className="analysis-label">Repair Items</div>
        </div>
      </div>

      {/* Cost Breakdown Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Cost by Unit */}
        <div className="card">
          <h2>Cost by Unit</h2>
          {databaseData.units && databaseData.units.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={databaseData.units.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="address_number" />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(value), 'Total Cost']} />
                <Bar dataKey="total_cost" fill="#667eea" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
              No unit data available
            </p>
          )}
        </div>

        {/* Cost by Supplier */}
        <div className="card">
          <h2>Cost by Supplier</h2>
          {databaseData.suppliers && databaseData.suppliers.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={databaseData.suppliers.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="supplier" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value) => [formatCurrency(value), 'Total Cost']} />
                <Bar dataKey="total_cost" fill="#764ba2" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
              No supplier data available
            </p>
          )}
        </div>
      </div>

      {/* Detailed Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Unit Cost Breakdown */}
        <div className="card">
          <h2>Cost per Unit</h2>
          {databaseData.units && databaseData.units.length > 0 ? (
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
                  {databaseData.units.map((unit, index) => (
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

        {/* Supplier Cost Breakdown */}
        <div className="card">
          <h2>Cost per Supplier</h2>
          {databaseData.suppliers && databaseData.suppliers.length > 0 ? (
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
                  {databaseData.suppliers.map((supplier, index) => (
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
      </div>

      {/* Repair Type Breakdown */}
      {databaseData.repairTypes && databaseData.repairTypes.length > 0 && (
        <div className="card">
          <h2>Cost per Repair Type</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Repair Type</th>
                  <th>Count</th>
                  <th>Total Cost</th>
                  <th>Average Cost</th>
                  <th>High Priority</th>
                </tr>
              </thead>
              <tbody>
                {databaseData.repairTypes.map((type, index) => (
                  <tr key={index}>
                    <td>{type.repair_type}</td>
                    <td>{type.count}</td>
                    <td className="cost">{formatCurrency(type.total_cost)}</td>
                    <td>{formatCurrency(type.average_cost)}</td>
                    <td>{type.high_priority_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="card">
        <h2>Database Summary</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ textAlign: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#667eea' }}>
              {databaseData.costs?.total_cost ? formatCurrency(databaseData.costs.total_cost) : '$0'}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>Grand Total</div>
          </div>
          
          <div style={{ textAlign: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#764ba2' }}>
              {databaseData.units?.length || 0}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>Total Units</div>
          </div>
          
          <div style={{ textAlign: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f093fb' }}>
              {databaseData.suppliers?.length || 0}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>Suppliers</div>
          </div>
          
          <div style={{ textAlign: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4ecdc4' }}>
              {databaseData.costs?.total_repairs || 0}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>Total Repairs</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DatabaseScreen;
