import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const UnitDisplay = ({ 
  unitData, 
  onUpdateRepairItem, 
  onNextUnit, 
  onPrevUnit, 
  onUnitSelect, 
  onSaveUnitChanges,
  onSaveToDatabase,
  currentIndex, 
  totalUnits, 
  allUnits 
}) => {
  const [repairItems, setRepairItems] = useState([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef(null);

  // Update repair items when unitData changes
  useEffect(() => {
    if (unitData && unitData.repair_items) {
      setRepairItems(unitData.repair_items);
      setHasUnsavedChanges(false); // Reset unsaved changes when switching units
    }
  }, [unitData]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Load supplier suggestions
  useEffect(() => {
    const loadSupplierSuggestions = async () => {
      try {
        // Get suppliers from current session
        const currentSuppliers = [];
        if (allUnits) {
          allUnits.forEach(unit => {
            if (unit.repair_items) {
              unit.repair_items.forEach(item => {
                if (item.supplier && item.supplier.trim() && !currentSuppliers.includes(item.supplier.trim())) {
                  currentSuppliers.push(item.supplier.trim());
                }
              });
            }
          });
        }

        // Get suppliers from analysis endpoint
        try {
          const response = await axios.get('/api/analysis/suppliers');
          if (response.data) {
            response.data.forEach(supplier => {
              if (supplier.supplier && !currentSuppliers.includes(supplier.supplier)) {
                currentSuppliers.push(supplier.supplier);
              }
            });
          }
        } catch (error) {
          console.log('Could not load suppliers from analysis endpoint');
        }

        setSupplierSuggestions(currentSuppliers);
      } catch (error) {
        console.error('Error loading supplier suggestions:', error);
      }
    };

    loadSupplierSuggestions();
  }, [allUnits]);

  const handleFieldChange = (itemIndex, field, value) => {
    const updatedItems = [...repairItems];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      [field]: value
    };
    setRepairItems(updatedItems);
    setHasUnsavedChanges(true);
    
    // Auto-save changes to parent component
    if (onSaveUnitChanges) {
      onSaveUnitChanges(currentIndex, updatedItems);
    }

    // Auto-save to database disabled to prevent data duplication
    // Use manual "Save Changes" button instead
    // if (autoSaveTimerRef.current) {
    //   clearTimeout(autoSaveTimerRef.current);
    // }
    // autoSaveTimerRef.current = setTimeout(() => {
    //   if (onSaveToDatabase) {
    //     onSaveToDatabase();
    //   }
    // }, 2000);
  };

  const handleSupplierChange = (itemIndex, value) => {
    // Trim whitespace to prevent duplicate suppliers
    const trimmedValue = value.trim();
    handleFieldChange(itemIndex, 'supplier', trimmedValue);
    setShowSupplierDropdown(false);
  };

  const handleSupplierFocus = () => {
    setShowSupplierDropdown(true);
  };

  const handleSupplierBlur = () => {
    // Delay hiding dropdown to allow for clicks
    setTimeout(() => setShowSupplierDropdown(false), 200);
  };

  const handleSaveChanges = () => {
    if (onSaveUnitChanges) {
      onSaveUnitChanges(currentIndex, repairItems);
    }
    if (onSaveToDatabase) {
      onSaveToDatabase();
    }
    setHasUnsavedChanges(false);
  };

  // Auto-save when navigating between units
  const handleNavigationWithSave = (navigationFunction) => {
    if (hasUnsavedChanges) {
      handleSaveChanges();
      // Show brief save confirmation
      setTimeout(() => {
        // The save success message from App.js will show
      }, 100);
    }
    navigationFunction();
  };

  if (!unitData) {
    return <div>No unit data available</div>;
  }

  // Filter items with descriptions
  const itemsWithDescriptions = repairItems.filter(item => 
    item.description && item.description.trim() !== ''
  );

  return (
    <div>
      {/* Unit Header */}
      <div className="unit-header">
        <div className="unit-info">
          <div className="unit-info-item">
            <div className="unit-info-label">Address Number</div>
            <div className="unit-info-value">{unitData.address_number || 'N/A'}</div>
          </div>
          <div className="unit-info-item">
            <div className="unit-info-label">Address Street</div>
            <div className="unit-info-value">{unitData.address_street || 'N/A'}</div>
          </div>
          <div className="unit-info-item">
            <div className="unit-info-label">Name 1</div>
            <div className="unit-info-value">{unitData.name1 || 'N/A'}</div>
          </div>
          <div className="unit-info-item">
            <div className="unit-info-label">Name 2</div>
            <div className="unit-info-value">{unitData.name2 || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Repair Items */}
      <div className="repair-items-container">
        {itemsWithDescriptions.map((item, index) => (
          <div key={item.id || index} className="repair-item">
            <div className="repair-item-header">
              <div className="repair-type">{item.repair_type}</div>
              <div className="repair-description">{item.description}</div>
            </div>
            
            <div className="repair-fields">
              <div className="field-group">
                <label>Priority</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={item.priority || ''}
                  onChange={(e) => handleFieldChange(index, 'priority', parseInt(e.target.value) || '')}
                />
              </div>
              
              <div className="field-group">
                <label>Estimated Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.estimated_cost || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = value === '' ? 0 : parseFloat(value);
                    handleFieldChange(index, 'estimated_cost', isNaN(numValue) ? 0 : numValue);
                  }}
                />
              </div>
              
              <div className="field-group supplier-suggestions">
                <label>Supplier</label>
                <input
                  type="text"
                  value={item.supplier || ''}
                  onChange={(e) => handleFieldChange(index, 'supplier', e.target.value)}
                  onFocus={handleSupplierFocus}
                  onBlur={handleSupplierBlur}
                  placeholder="Enter supplier name"
                />
                {showSupplierDropdown && supplierSuggestions.length > 0 && (
                  <div className="supplier-dropdown">
                    {supplierSuggestions
                      .filter(supplier => 
                        supplier.toLowerCase().includes((item.supplier || '').toLowerCase())
                      )
                      .map((supplier, idx) => (
                        <div
                          key={idx}
                          className="supplier-suggestion"
                          onClick={() => handleSupplierChange(index, supplier)}
                        >
                          {supplier}
                        </div>
                      ))}
                  </div>
                )}
              </div>
              
              <div className="field-group">
                <label>Required Completion Date</label>
                <input
                  type="date"
                  value={item.required_completion_date || ''}
                  onChange={(e) => handleFieldChange(index, 'required_completion_date', e.target.value)}
                />
              </div>
              
              <div className="field-group">
                <label>Status</label>
                <select
                  value={item.actual_completion_status || 'incomplete'}
                  onChange={(e) => handleFieldChange(index, 'actual_completion_status', e.target.value)}
                >
                  <option value="incomplete">Incomplete</option>
                  <option value="in progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              
              <div className="field-group">
                <label>Actual Completion Date</label>
                <input
                  type="date"
                  value={item.actual_completion_date || ''}
                  onChange={(e) => handleFieldChange(index, 'actual_completion_date', e.target.value)}
                  disabled={item.actual_completion_status === 'incomplete'}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          padding: '10px',
          margin: '10px 0',
          color: '#856404'
        }}>
          ⚠️ <strong>You have unsaved changes!</strong> Click "Save Changes" or navigate to another unit to auto-save and update reports.
        </div>
      )}

      {/* Navigation */}
      <div className="navigation">
        <div className="nav-buttons">
          <button 
            className="btn btn-secondary" 
            onClick={() => handleNavigationWithSave(onPrevUnit)}
            disabled={currentIndex === 0}
          >
            ← Previous Unit
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => handleNavigationWithSave(onNextUnit)}
            disabled={currentIndex >= totalUnits - 1}
          >
            Next Unit →
          </button>
        </div>
        
        <div className="unit-selector">
          <label>Jump to Unit:</label>
          <select 
            value={currentIndex} 
            onChange={(e) => handleNavigationWithSave(() => onUnitSelect(parseInt(e.target.value)))}
          >
            {allUnits.map((unit, index) => (
              <option key={index} value={index}>
                {unit.address_number} {unit.address_street} - {unit.name1}
              </option>
            ))}
          </select>
        </div>
        
        <button 
          className={`btn ${hasUnsavedChanges ? 'btn-warning' : 'btn-success'}`}
          onClick={handleSaveChanges}
          style={{
            backgroundColor: hasUnsavedChanges ? '#ffc107' : '#28a745',
            color: hasUnsavedChanges ? '#000' : '#fff',
            fontWeight: hasUnsavedChanges ? 'bold' : 'normal'
          }}
        >
          {hasUnsavedChanges ? '⚠️ Save Changes (Unsaved)' : '✅ Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default UnitDisplay;
