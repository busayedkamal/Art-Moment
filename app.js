// تطبيق لحظة فن - Art Moment
class ArtMomentApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.orders = [];
        this.customers = [];
        this.init();
    }

    init() {
        console.log('🚀 تطبيق لحظة فن يعمل بنجاح!');
        this.loadSampleData();
        this.setupNavigation();
        this.setupEventListeners();
        this.showCurrentPage(); // تأكد من عرض الصفحة الحالية
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page || 'dashboard';
                this.navigateTo(page);
            });
        });
    }

    navigateTo(page) {
        this.currentPage = page;
        
        // تحديث القائمة النشطة
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[data-page="${page}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        this.showCurrentPage();
        this.updatePageContent(page);
    }

    showCurrentPage() {
        // إخفاء جميع الأقسام أولاً
        document.querySelectorAll('.page-section').forEach(section => {
            section.style.display = 'none';
        });

        // إظهار القسم الحالي فقط
        const currentSection = document.getElementById(`${this.currentPage}-section`);
        if (currentSection) {
            currentSection.style.display = 'block';
        } else {
            // إذا لم يكن هناك قسم، عرض لوحة التحكم
            const dashboardSection = document.getElementById('dashboard-section');
            if (dashboardSection) {
                dashboardSection.style.display = 'block';
            }
        }
    }

    updatePageContent(page) {
        switch(page) {
            case 'orders':
                this.renderOrdersTable();
                break;
            case 'customers':
                this.renderCustomersTable();
                break;
            case 'payments':
                this.renderPaymentsTable();
                break;
            default:
                this.renderDashboard();
                break;
        }
    }

    loadSampleData() {
        // بيانات تجريبية للطلبات
        this.orders = [
            {
                id: 'ORD-001',
                customer: 'أحمد محمد',
                product: 'بطاقات عمل - متميز',
                quantity: 1000,
                total: 245,
                status: 'completed',
                date: '2024-01-15'
            },
            {
                id: 'ORD-002',
                customer: 'شركة التقنية',
                product: 'بروشورات - ملونة',
                quantity: 500,
                total: 420,
                status: 'processing',
                date: '2024-01-16'
            },
            {
                id: 'ORD-003',
                customer: 'مؤسسة النجاح',
                product: 'ملصقات - حجم A4',
                quantity: 2000,
                total: 180,
                status: 'pending',
                date: '2024-01-17'
            }
        ];

        this.customers = [
            { id: 1, name: 'أحمد محمد', email: 'ahmed@example.com', phone: '0551234567', orders: 5 },
            { id: 2, name: 'فاطمة عبدالله', email: 'fatima@example.com', phone: '0509876543', orders: 3 },
            { id: 3, name: 'خالد سعيد', email: 'khaled@example.com', phone: '0541112233', orders: 2 }
        ];
    }

    renderDashboard() {
        console.log('عرض لوحة التحكم...');
        // تحديث الإحصائيات
        const totalRevenue = this.orders.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = this.orders.length;
        
        // تحديث العناصر إذا وجدت
        const revenueElements = document.querySelectorAll('.stat-card.revenue .stat-number');
        const ordersElements = document.querySelectorAll('.stat-card.orders .stat-number');
        
        revenueElements.forEach(el => {
            if (el) el.textContent = `$${totalRevenue}`;
        });
        
        ordersElements.forEach(el => {
            if (el) el.textContent = totalOrders.toString();
        });
    }

    renderOrdersTable() {
        const tbody = document.querySelector('#orders-table tbody');
        if (!tbody) {
            console.error('❌ لم يتم العثور على #orders-table tbody');
            return;
        }

        tbody.innerHTML = this.orders.map(order => `
            <tr>
                <td>${order.id}</td>
                <td>${order.customer}</td>
                <td>${order.product}</td>
                <td>${order.quantity.toLocaleString()}</td>
                <td>$${order.total}</td>
                <td>
                    <span class="status-badge ${order.status}">
                        ${this.getStatusText(order.status)}
                    </span>
                </td>
                <td>
                    <button class="btn-icon" onclick="app.editOrder('${order.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="app.deleteOrder('${order.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        console.log('✅ تم عرض جدول الطلبات');
    }

    renderCustomersTable() {
        const tbody = document.querySelector('#customers-table tbody');
        if (!tbody) {
            console.error('❌ لم يتم العثور على #customers-table tbody');
            return;
        }

        tbody.innerHTML = this.customers.map(customer => `
            <tr>
                <td>${customer.name}</td>
                <td>${customer.email}</td>
                <td>${customer.phone}</td>
                <td>${customer.orders}</td>
                <td>
                    <button class="btn-icon" onclick="app.editCustomer(${customer.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderPaymentsTable() {
        const tbody = document.querySelector('#payments-table tbody');
        if (!tbody) {
            console.error('❌ لم يتم العثور على #payments-table tbody');
            return;
        }

        // بيانات تجريبية للمدفوعات
        const payments = [
            { id: 'PAY-001', orderId: 'ORD-001', amount: 245, date: '2024-01-15', method: 'تحويل بنكي' },
            { id: 'PAY-002', orderId: 'ORD-002', amount: 210, date: '2024-01-16', method: 'نقدي' },
            { id: 'PAY-003', orderId: 'ORD-003', amount: 90, date: '2024-01-17', method: 'بطاقة ائتمان' }
        ];

        tbody.innerHTML = payments.map(payment => `
            <tr>
                <td>${payment.id}</td>
                <td>${payment.orderId}</td>
                <td>$${payment.amount}</td>
                <td>${payment.date}</td>
                <td>${payment.method}</td>
            </tr>
        `).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'completed': 'مكتمل',
            'processing': 'قيد المعالجة',
            'pending': 'قيد الانتظار'
        };
        return statusMap[status] || status;
    }

    // إضافة الدوال الناقصة
    renderFilteredOrders(filteredOrders) {
        const tbody = document.querySelector('#orders-table tbody');
        if (!tbody) return;

        tbody.innerHTML = filteredOrders.map(order => `
            <tr>
                <td>${order.id}</td>
                <td>${order.customer}</td>
                <td>${order.product}</td>
                <td>${order.quantity.toLocaleString()}</td>
                <td>$${order.total}</td>
                <td>
                    <span class="status-badge ${order.status}">
                        ${this.getStatusText(order.status)}
                    </span>
                </td>
                <td>
                    <button class="btn-icon" onclick="app.editOrder('${order.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="app.deleteOrder('${order.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    filterOrders(searchTerm) {
        const filtered = this.orders.filter(order => 
            order.customer.includes(searchTerm) || 
            order.product.includes(searchTerm) ||
            order.id.includes(searchTerm)
        );
        this.renderFilteredOrders(filtered);
    }

    setupEventListeners() {
        // بحث في الطلبات
        const searchInput = document.querySelector('.search-container input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterOrders(e.target.value);
            });
        }

        // إضافة طلب جديد
        const addOrderBtn = document.querySelector('.add-order-btn');
        if (addOrderBtn) {
            addOrderBtn.addEventListener('click', () => {
                this.showAddOrderForm();
            });
        }
    }

    showAddOrderForm() {
        const formHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>إضافة طلب جديد</h3>
                    <form id="add-order-form">
                        <div class="form-group">
                            <label>اسم العميل</label>
                            <input type="text" id="customer-name" required>
                        </div>
                        <div class="form-group">
                            <label>نوع المنتج</label>
                            <select id="product-type" required>
                                <option value="">اختر المنتج</option>
                                <option value="بطاقات عمل - متميز">بطاقات عمل - متميز</option>
                                <option value="بروشورات - ملونة">بروشورات - ملونة</option>
                                <option value="ملصقات - حجم A4">ملصقات - حجم A4</option>
                                <option value="بوسترات - كبيرة">بوسترات - كبيرة</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>الكمية</label>
                            <input type="number" id="quantity" required min="1">
                        </div>
                        <div class="form-group">
                            <label>السعر الإجمالي</label>
                            <input type="number" id="total" required min="0" step="0.01">
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="app.hideModal()">إلغاء</button>
                            <button type="submit" class="btn-primary">حفظ الطلب</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', formHTML);
        
        document.getElementById('add-order-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveNewOrder();
        });
    }

    saveNewOrder() {
        const customerName = document.getElementById('customer-name').value;
        const productType = document.getElementById('product-type').value;
        const quantity = parseInt(document.getElementById('quantity').value);
        const total = parseFloat(document.getElementById('total').value);

        const newOrder = {
            id: 'ORD-' + (this.orders.length + 1).toString().padStart(3, '0'),
            customer: customerName,
            product: productType,
            quantity: quantity,
            total: total,
            status: 'pending',
            date: new Date().toISOString().split('T')[0]
        };

        this.orders.unshift(newOrder);
        this.hideModal();
        this.showNotification('تم إضافة الطلب بنجاح!');
        
        // تحديث العرض إذا كنا في صفحة الطلبات
        if (this.currentPage === 'orders') {
            this.renderOrdersTable();
        }
    }

    editOrder(orderId) {
        this.showNotification(`تعديل الطلب: ${orderId} - هذه الميزة قيد التطوير`);
    }

    deleteOrder(orderId) {
        if (confirm(`هل أنت متأكد من حذف الطلب ${orderId}؟`)) {
            this.orders = this.orders.filter(order => order.id !== orderId);
            this.showNotification('تم حذف الطلب بنجاح!');
            
            if (this.currentPage === 'orders') {
                this.renderOrdersTable();
            }
        }
    }

    editCustomer(customerId) {
        this.showNotification(`تعديل العميل: ${customerId} - هذه الميزة قيد التطوير`);
    }

    hideModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }

    showNotification(message) {
        // إزالة أي إشعارات سابقة
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// جعل الكائن متاحاً globally
window.app = new ArtMomentApp();
