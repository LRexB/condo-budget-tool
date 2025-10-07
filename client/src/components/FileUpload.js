import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

function FileUpload({ onFileUpload, loading }) {
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      className={`upload-area ${isDragActive ? 'dragover' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="upload-icon">📁</div>
      <div className="upload-text">
        {loading ? 'Processing file...' : isDragActive ? 'Drop the CSV file here' : 'Click to upload or drag and drop CSV file'}
      </div>
      <div className="upload-subtext">
        Supports CSV files (.csv)
      </div>
      <div className="upload-subtext" style={{ marginTop: '1rem', fontSize: '0.8rem', textAlign: 'left' }}>
        <strong>Expected CSV format:</strong><br/>
        • First 4 columns: Address Number, Address Street, Name1, Name2<br/>
        • Remaining columns: Repair items (column headers = repair types, cell values = descriptions)<br/>
        • Example: "123", "Main St", "John Doe", "Jane Doe", "Roof Repair", "HVAC", "Plumbing"
      </div>
    </div>
  );
}

export default FileUpload;