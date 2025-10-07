# Condominium Repair Management System

A comprehensive web application for managing repair requirements across condominium complexes. Upload CSV files with repair data, edit priorities and costs, and generate detailed analysis reports.

## Features

### 📁 CSV File Upload
- Upload CSV files with condominium repair data
- First 4 columns: Address Number, Address Street, Name1, Name2
- Remaining columns: Repair items (column headers = repair types, cell values = descriptions)

### 🏢 Unit Management
- Display each unit with fixed header showing unit information
- Scrollable list of repair items for each unit
- Edit repair priorities (1-10), estimated costs, suppliers, and completion dates
- Navigate between units easily

### 📊 Analysis & Reporting
- **Cost Analysis**: Total costs, average costs, high-priority costs
- **Supplier Analysis**: Cost breakdown by supplier with charts and tables
- **Unit Analysis**: Cost breakdown by unit with priority analysis
- **Schedule Analysis**: Completion dates and associated costs
- Interactive charts and detailed tables

### 💾 Database Storage
- SQLite database for persistent storage
- Automatic data backup and retrieval
- Real-time updates when editing repair items

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm

### Setup Instructions

1. **Install Dependencies**
   ```bash
   cd condo_budget_tool
   npm run install-all
   ```

2. **Start the Application**
   ```bash
   # Start the backend server
   npm start
   
   # In a new terminal, start the frontend (development)
   cd client
   npm start
   ```

3. **Access the Application**
   - Backend API: http://localhost:3001
   - Frontend: http://localhost:3000

## CSV File Format

Your CSV file should follow this format:

```csv
Address Number,Address Street,Name1,Name2,Roof Repair,HVAC,Plumbing,Electrical
123,Main St,John Doe,Jane Doe,"Roof needs patching","AC unit not working","Kitchen sink leak","Outlets not working"
456,Oak Ave,Smith Family,,,"Heater broken",,"Light fixture needs repair"
```

### Column Requirements:
- **Columns 1-4 (Fixed)**: Address Number, Address Street, Name1, Name2
- **Columns 5+ (Repair Items)**: Any number of repair types as column headers
- **Cell Values**: Descriptions of repair needs (can be empty)

## Usage

### 1. Upload Data
- Click "Upload CSV File" or drag and drop your CSV file
- The system will parse and display your data

### 2. Edit Repair Items
- Navigate through units using Previous/Next buttons
- For each repair item, set:
  - **Priority** (1-10): Higher numbers = higher priority
  - **Estimated Cost**: Dollar amount for the repair
  - **Proposed Supplier**: Company or contractor name
  - **Completion Date**: When the repair should be completed

### 3. Save Data
- Click "Save to Database" to store all changes
- Data persists between sessions

### 4. View Analysis
- Click "View Analysis" to see comprehensive reports
- Charts show cost breakdowns by supplier and unit
- Tables provide detailed financial analysis
- Schedule analysis shows completion timelines

## API Endpoints

- `POST /api/upload` - Upload and parse CSV files
- `POST /api/save-data` - Save processed data to database
- `GET /api/units` - Get all units with summary data
- `GET /api/units/:id` - Get specific unit with repair items
- `PUT /api/repair-items/:id` - Update repair item details
- `GET /api/analysis/costs` - Get cost analysis data
- `GET /api/analysis/suppliers` - Get supplier analysis
- `GET /api/analysis/units` - Get unit analysis
- `GET /api/analysis/dates` - Get completion date analysis

## Technology Stack

- **Backend**: Node.js, Express.js, SQLite3
- **Frontend**: React.js, Recharts for visualization
- **File Processing**: CSV parser, Multer for uploads
- **Database**: SQLite for lightweight data storage

## Database Schema

### Units Table
- `id` (Primary Key)
- `address_number`
- `address_street`
- `name1`
- `name2`
- `created_at`

### Repair Items Table
- `id` (Primary Key)
- `unit_id` (Foreign Key)
- `repair_type`
- `description`
- `priority` (1-10)
- `estimated_cost`
- `supplier`
- `completion_date`
- `created_at`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

