// تطبيق لحظة فن - Art Moment
class ArtMomentApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        console.log('🚀 تطبيق لحظة فن يعمل بنجاح!');
        this.setupNavigation();
        this.loadSampleData();
        this.setupEventListeners();
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
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        // إخفاء جميع الأقسام
        document.querySelectorAll('.page-section').forEach(section => {
            section.style.display = 'none';
        });

        // إظهار القسم المطلوب
        const targetSection = document.getElementById(`${page}-section`);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        this.updatePageContent(page);
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

    renderOrdersTable() {
        const tbody = document.querySelector('#orders-table tbody');
        if (!tbody) return;

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
    }

    getStatusText(status) {
        const statusMap = {
            'completed': 'مكتمل',
            'processing': 'قيد المعالجة',
            'pending': 'قيد الانتظار'
        };
        return statusMap[status] || status;
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

    filterOrders(searchTerm) {
        const filtered = this.orders.filter(order => 
            order.customer.includes(searchTerm) || 
            order.product.includes(searchTerm) ||
            order.id.includes(searchTerm)
        );
        this.renderFilteredOrders(filtered);
    }

    showAddOrderForm() {
        const formHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>إضافة طلب جديد</h3>
                    <form id="add-order-form">
                        <div class="form-group">
                            <label>اسم العميل</label>
                            <input type="text" required>
                        </div>
                        <div class="form-group">
                            <label>نوع المنتج</label>
                            <select required>
                                <option value="">اختر المنتج</option>
                                <option value="بطاقات عمل">بطاقات عمل</option>
                                <option value="بروشورات">بروشورات</option>
                                <option value="ملصقات">ملصقات</option>
                                <option value="بوسترات">بوسترات</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>الكمية</label>
                            <input type="number" required min="1">
                        </div>
                        <div class="form-group">
                            <label>السعر الإجمالي</label>
                            <input type="number" required min="0" step="0.01">
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
        // كود حفظ الطلب الجديد
        this.hideModal();
        this.showNotification('تم إضافة الطلب بنجاح!');
    }

    hideModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// تهيئة التطبيق
const app = new ArtMomentApp();
