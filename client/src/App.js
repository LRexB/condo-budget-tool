import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FileUpload from './components/FileUpload';
import UnitDisplay from './components/UnitDisplay';
import AnalysisScreen from './components/AnalysisScreen';
import DatabaseScreen from './components/DatabaseScreen';

function App() {
  const [currentView, setCurrentView] = useState('upload'); // 'upload', 'units', 'analysis', 'database'
  const [uploadedData, setUploadedData] = useState(null);
  const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load session data on component mount
  useEffect(() => {
    handleLoadPreviousSession();
  }, []);

  const loadUnits = async () => {
    try {
      const response = await axios.get('/api/units');
      setUnits(response.data);
    } catch (err) {
      console.error('Error loading units:', err);
    }
  };

  const handleFileUpload = async (file) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setUploadedData(response.data.data);
      setCurrentView('units');
      setCurrentUnitIndex(0);
      setSuccess(`Successfully loaded ${response.data.total_units} units from CSV file`);
    } catch (err) {
      setError(err.response?.data?.error || 'Error processing file');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveData = async () => {
    if (!uploadedData) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/save-data', { units: uploadedData });
      setSuccess('Data saved successfully to database!');
      // Update the uploaded data with the saved data that includes IDs
      if (response.data.savedData) {
        setUploadedData(response.data.savedData);
      }
      await loadUnits(); // Refresh units list
    } catch (err) {
      setError(err.response?.data?.error || 'Error saving data');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPreviousSession = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load the session data (database is already loaded on server startup)
      const response = await axios.get('/api/load-session');
      if (response.data && response.data.length > 0) {
        setUploadedData(response.data);
        setCurrentView('units');
        setCurrentUnitIndex(0);
        setSuccess(`Loaded previous session with ${response.data.length} units`);
      } else {
        setError('No data found in current session. Please upload a CSV file first.');
      }
    } catch (err) {
      console.error('Error loading previous session:', err);
      setError(err.response?.data?.error || 'Error loading previous session');
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = async () => {
    if (uploadedData && uploadedData.length > 0) {
      const confirmed = window.confirm('Are you sure you want to start a new session? This will create a new database, but your current data will be preserved in the previous database.');
      if (!confirmed) return;
    }
    
    try {
      setLoading(true);
      // Create a new database session
      await axios.post('/api/new-session');
      setUploadedData([]);
      setCurrentView('upload');
      setCurrentUnitIndex(0);
      setError(null);
      setSuccess('New session created successfully');
    } catch (error) {
      console.error('Error creating new session:', error);
      setError('Error creating new session');
    } finally {
      setLoading(false);
    }
  };

  const handleNextUnit = () => {
    if (uploadedData && currentUnitIndex < uploadedData.length - 1) {
      setCurrentUnitIndex(currentUnitIndex + 1);
    }
  };

  const handleSaveUnitChanges = (unitIndex, updatedRepairItems) => {
    if (uploadedData) {
      const updatedData = [...uploadedData];
      updatedData[unitIndex] = {
        ...updatedData[unitIndex],
        repair_items: updatedRepairItems
      };
      setUploadedData(updatedData);
    }
  };

  const handleSaveToDatabase = async () => {
    if (uploadedData) {
      setLoading(true);
      setError('');
      setSuccess('');
      try {
        await axios.post('/api/save-data', { units: uploadedData });
        setSuccess('Changes saved to database successfully! Analysis reports updated.');
        setRefreshKey(prev => prev + 1); // Force refresh of analysis screens
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        console.error('Error saving changes to database:', error);
        setError('Error saving changes to database');
        setTimeout(() => setError(''), 5000);
      } finally {
        setLoading(false);
      }
    }
  };

  // Navigate with auto-save
  const navigateWithSave = async (newView) => {
    if (uploadedData) {
      try {
        await axios.post('/api/save-data', { units: uploadedData });
        setSuccess('Changes auto-saved!');
        setRefreshKey(prev => prev + 1);
        setTimeout(() => setSuccess(''), 2000);
      } catch (error) {
        console.error('Error auto-saving:', error);
      }
    }
    setCurrentView(newView);
  };

  const handleUnitSelect = (unitIndex) => {
    if (uploadedData && unitIndex >= 0 && unitIndex < uploadedData.length) {
      setCurrentUnitIndex(unitIndex);
    }
  };


  const handlePrevUnit = () => {
    if (currentUnitIndex > 0) {
      setCurrentUnitIndex(currentUnitIndex - 1);
    }
  };

  const handleUpdateRepairItem = async (unitId, repairItemId, updatedData) => {
    try {
      await axios.put(`/api/repair-items/${repairItemId}`, updatedData);
      setSuccess('Repair item updated successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating repair item');
    }
  };


  const renderCurrentView = () => {
    switch (currentView) {
      case 'upload':
        return (
          <div>
            <div className="card">
              <h2>Upload Condominium Repair Data</h2>
              <FileUpload onFileUpload={handleFileUpload} loading={loading} />
              {error && <div className="error">{error}</div>}
              {success && <div className="success">{success}</div>}
            </div>
            
            <div className="card">
              <h2>Continue Previous Session</h2>
              <p>Load data from a previous session that was saved to the database.</p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-info" 
                  onClick={handleLoadPreviousSession}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load Current Session'}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleNewSession}
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'New Session'}
                </button>
              </div>
              <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                Load Current Session: Load data from the currently active database.<br/>
                New Session: Start fresh with a new database.
              </div>
            </div>
          </div>
        );

      case 'units':
        if (!uploadedData || uploadedData.length === 0) {
          return (
            <div className="card">
              <h2>No Units Found</h2>
              <p>Please upload a CSV file with unit data first.</p>
              <button className="btn" onClick={() => setCurrentView('upload')}>
                Upload File
              </button>
            </div>
          );
        }

        return (
          <div>
            <div className="nav-buttons">
              <button className="btn btn-secondary" onClick={() => setCurrentView('upload')}>
                ← Back to Upload
              </button>
              <div className="unit-counter">
                Unit {currentUnitIndex + 1} of {uploadedData.length}
              </div>
              <div>
                <button 
                  className="btn btn-info" 
                  onClick={() => navigateWithSave('analysis')}
                  disabled={!uploadedData || uploadedData.length === 0}
                >
                  View Analysis
                </button>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                  💡 Changes auto-save when navigating between units or to reports
                </div>
                <button 
                  className="btn btn-success" 
                  onClick={handleSaveData}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save to Database'}
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to start a new session? This will clear all current data.')) {
                      setUploadedData(null);
                      setCurrentView('upload');
                    }
                  }}
                >
                  New Session
                </button>
              </div>
            </div>

            <UnitDisplay
              unitData={uploadedData[currentUnitIndex]}
              onUpdateRepairItem={handleUpdateRepairItem}
              onNextUnit={handleNextUnit}
              onPrevUnit={handlePrevUnit}
              onUnitSelect={handleUnitSelect}
              onSaveUnitChanges={handleSaveUnitChanges}
              onSaveToDatabase={handleSaveToDatabase}
              currentIndex={currentUnitIndex}
              totalUnits={uploadedData.length}
              allUnits={uploadedData}
            />
            {/* Debug info for units 62-71 issue */}
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5' }}>
              <strong>Debug Info:</strong><br/>
              Current Unit Index: {currentUnitIndex}<br/>
              Total Units: {uploadedData?.length || 0}<br/>
              Current Unit Data: {uploadedData?.[currentUnitIndex] ? 'Present' : 'Missing'}<br/>
              Units 60-70: {uploadedData?.slice(60, 71).map((unit, idx) => `${60 + idx}: ${unit?.address_number || 'N/A'}`).join(', ')}
            </div>
          </div>
        );

      case 'analysis':
        return (
          <div>
            <div className="nav-buttons">
              <button className="btn btn-secondary" onClick={() => setCurrentView('units')}>
                ← Back to Units
              </button>
              <h2>Analysis & Reports</h2>
              <div>
                <button className="btn btn-info" onClick={() => navigateWithSave('database')}>
                  Database View
                </button>
                <button className="btn" onClick={() => setCurrentView('upload')}>
                  Upload New File
                </button>
              </div>
            </div>
            <AnalysisScreen key={refreshKey} />
          </div>
        );

      case 'database':
        return (
          <div>
            <div className="nav-buttons">
              <button className="btn btn-secondary" onClick={() => setCurrentView('analysis')}>
                ← Back to Analysis
              </button>
              <h2>Database Access & Cost Breakdown</h2>
              <div>
                <button className="btn btn-info" onClick={() => setRefreshKey(prev => prev + 1)}>
                  Refresh Data
                </button>
                <button className="btn" onClick={() => setCurrentView('upload')}>
                  Upload New File
                </button>
              </div>
            </div>
            <DatabaseScreen key={refreshKey} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>🏢 Condominium Repair Manager</h1>
        <p>Upload, manage, and analyze repair requirements for your condominium complex</p>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {renderCurrentView()}
    </div>
  );
}

export default App;