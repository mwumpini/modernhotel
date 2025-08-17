# 🏨 Ghana Hotel Management System

A comprehensive, modern hospitality management system designed specifically for Ghanaian hotels with offline capabilities and Ghana compliance features.

## ✨ Features

### 🌐 **Offline Capabilities (NEW!)**
- **Service Worker Integration**: Automatic caching of essential resources
- **Offline Data Storage**: Local storage for bookings, check-ins, payments
- **Background Sync**: Automatic data synchronization when online
- **Offline-First Design**: Core functions work without internet
- **PWA Support**: Installable as mobile app
- **Smart Caching**: Intelligent resource management

### 🏨 **Front Office Operations**
- **Comprehensive Dashboard**: Room status overview, occupancy tracking
- **Guest Management**: Check-in/out, guest profiles, Ghana Card verification
- **Booking Engine**: Reservation management, group bookings
- **Room Management**: Status grid, maintenance tracking, cleaning schedules
- **Conference Halls**: Event booking, facility management
- **Invoice Generation**: Automated billing, receipt creation

### 🍽️ **Food & Beverage Management**
- **POS Integration**: Point of sale operations
- **Kitchen Operations**: Order management, station monitoring
- **Inventory Control**: Stock management, low stock alerts
- **Menu Management**: Dynamic menu updates, pricing
- **Staff Performance**: Productivity tracking, shift management

### 🛏️ **Housekeeping & Maintenance**
- **Room Status Grid**: Real-time room status visualization
- **Work Orders**: Maintenance request management
- **Inspection Checklists**: Quality control procedures
- **Deep Cleaning Scheduler**: Preventive maintenance
- **Staff Assignment**: Task distribution and tracking

### 🚨 **Security Operations**
- **Incident Management**: Security event tracking
- **Camera System**: CCTV monitoring and status
- **Access Control**: Key card management, visitor logs
- **Patrol Tracking**: Security guard monitoring
- **Emergency Protocols**: Crisis response procedures

### 👥 **HR & Payroll**
- **Staff Management**: Employee records, scheduling
- **Shift Management**: Work schedule coordination
- **Training Records**: Skill development tracking
- **Payroll Processing**: Automated salary calculations
- **Benefits Administration**: Employee benefit management

### 🧾 **Complete Accounting System**
- **CFO Dashboard**: Financial overview and insights
- **Chart of Accounts**: Comprehensive financial structure
- **Bank & Cash Management**: Financial institution integration
- **Accounts Payable/Receivable**: Vendor and customer management
- **Inventory Accounting**: Asset tracking and valuation
- **Ghana Compliance**: VAT, NHIL, SSNIT automation

### 📈 **Reports & Analytics**
- **Operational Reports**: Daily operations insights
- **Compliance Reports**: Ghana regulatory requirements
- **VAT/NHIL Returns**: Automated tax calculations
- **Tourism Levy**: Government compliance automation
- **SSNIT Filings**: Employee contribution management

### ⚙️ **System Settings**
- **User Role Matrix**: Permission management
- **Activity Logs**: System audit trails
- **Tax Rule Setup**: Ghana tax configuration
- **Mobile Money APIs**: Payment integration
- **Localization**: Multi-language support
- **GRA Templates**: Government compliance forms

## 🚀 **Offline Features**

### ✅ **Available Offline**
- View cached dashboards
- Access stored guest data
- Create new bookings
- Process check-ins/outs
- Record payments
- Update inventory
- Generate invoices
- Room status management

### ⚠️ **Limited Offline**
- Real-time updates
- External API calls
- Cloud backups
- Multi-location sync
- Email notifications
- Third-party integrations

### 🔄 **Auto-Sync When Online**
- All offline data automatically syncs
- No data loss
- Background processing
- Retry mechanisms
- Conflict resolution

## 🛠️ **Technology Stack**

- **Frontend**: Next.js 15.4.6, React 18
- **UI Framework**: HeroUI (@heroui/react 2.8.2)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Offline**: Service Workers, IndexedDB, LocalStorage
- **PWA**: Web App Manifest, Service Worker
- **Backend**: Node.js
- **Package Manager**: npm

## 📱 **Installation & Usage**

### **Development Setup**
```bash
# Clone repository
git clone [repository-url]
cd ghana-hotel-management

# Install dependencies
npm install

# Start development server
npm run dev
```

### **Offline Setup**
1. **Automatic**: Service worker registers automatically
2. **Manual**: Navigate to `/offline` for offline page
3. **PWA**: Install as mobile app for offline access

### **Service Worker**
- **File**: `/public/sw.js`
- **Scope**: `/`
- **Features**: Caching, offline fallbacks, background sync

## 🇬🇭 **Ghana-Specific Features**

### **Compliance Automation**
- **Ghana Card Verification**: National ID validation
- **VAT/NHIL Calculation**: Automated tax computation
- **SSNIT Compliance**: Employee contribution management
- **Tourism Levy**: Government fee automation
- **GRA Templates**: Official form integration

### **Local Payment Integration**
- **Mobile Money**: MTN, Vodafone, AirtelTigo
- **Bank Integration**: Local bank APIs
- **Cash Management**: Local currency handling
- **Receipt Generation**: Ghana-compliant formats

## 🔧 **Configuration**

### **Environment Variables**
```env
NEXT_PUBLIC_APP_NAME="Ghana Hotel Management"
NEXT_PUBLIC_OFFLINE_ENABLED=true
NEXT_PUBLIC_SERVICE_WORKER_ENABLED=true
```

### **Offline Settings**
- **Cache Strategy**: Network-first with offline fallback
- **Storage Limits**: Configurable cache sizes
- **Sync Intervals**: Customizable sync frequencies
- **Retry Logic**: Exponential backoff for failed syncs

## 📊 **Dashboard Structure**

### **Main Dashboard**
- **Quick Stats**: Room occupancy, revenue, availability
- **Quick Actions**: New booking, check-in, check-out
- **Recent Activity**: Latest system events
- **Offline Status**: Connection and sync indicators

### **Department Dashboards**
- **Frontdesk**: Guest services, room management
- **F&B**: Restaurant and bar operations
- **Housekeeping**: Maintenance and cleaning
- **Security**: Safety and incident management
- **HR**: Staff and payroll management
- **Accounting**: Financial operations

## 🔒 **Security Features**

### **Access Control**
- **Role-Based Permissions**: Granular access control
- **Session Management**: Secure authentication
- **Activity Logging**: Comprehensive audit trails
- **Data Encryption**: Secure data transmission

### **Offline Security**
- **Local Data Protection**: Encrypted local storage
- **Secure Sync**: Authenticated data synchronization
- **Conflict Resolution**: Data integrity maintenance

## 📱 **Mobile & PWA Features**

### **Progressive Web App**
- **Installable**: Add to home screen
- **Offline Support**: Works without internet
- **Push Notifications**: Real-time updates
- **Background Sync**: Data synchronization

### **Responsive Design**
- **Mobile-First**: Optimized for mobile devices
- **Touch-Friendly**: Gesture-based interactions
- **Adaptive Layout**: Responsive to screen sizes

## 🚀 **Performance Features**

### **Optimization**
- **Code Splitting**: Lazy-loaded components
- **Image Optimization**: WebP format support
- **Bundle Analysis**: Performance monitoring
- **Caching Strategy**: Intelligent resource caching

### **Offline Performance**
- **Instant Loading**: Cached resource access
- **Background Processing**: Non-blocking operations
- **Smart Preloading**: Predictive resource loading

## 🔄 **Updates & Maintenance**

### **Service Worker Updates**
- **Automatic Updates**: Background update detection
- **Version Management**: Cache versioning
- **Rollback Support**: Previous version restoration

### **Data Migration**
- **Schema Evolution**: Database structure updates
- **Data Validation**: Integrity checks
- **Backup & Restore**: Data protection

## 📈 **Monitoring & Analytics**

### **System Health**
- **Offline Metrics**: Connection status tracking
- **Sync Performance**: Data synchronization metrics
- **Cache Efficiency**: Storage utilization monitoring
- **Error Tracking**: Issue identification and resolution

### **Business Intelligence**
- **Occupancy Analytics**: Room utilization insights
- **Revenue Tracking**: Financial performance metrics
- **Guest Analytics**: Customer behavior analysis
- **Operational Reports**: Performance indicators

## 🤝 **Contributing**

### **Development Guidelines**
- **Code Style**: TypeScript with strict typing
- **Component Structure**: Reusable, modular design
- **Testing**: Unit and integration tests
- **Documentation**: Comprehensive code comments

### **Feature Requests**
- **Enhancement Proposals**: Detailed feature specifications
- **Bug Reports**: Reproducible issue descriptions
- **Performance Issues**: Optimization opportunities

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 **Support**

### **Documentation**
- **User Guides**: Step-by-step instructions
- **API Reference**: Technical documentation
- **Troubleshooting**: Common issue solutions

### **Contact**
- **Technical Support**: Development team assistance
- **Feature Requests**: Enhancement suggestions
- **Bug Reports**: Issue reporting and tracking

---

**Built with ❤️ for Ghanaian Hospitality Excellence**
