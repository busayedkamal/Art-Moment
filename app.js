// تطبيق لحظة فن - Art Moment
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 تطبيق لحظة فن يعمل بنجاح!');
    
    // تفعيل الروابط في القائمة الجانبية
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // إزالة النشاط من جميع الروابط
            navLinks.forEach(l => l.classList.remove('active'));
            
            // إضافة النشاط للرابط المختار
            this.classList.add('active');
            
            // عرض رسالة توضيحية (يمكن استبدالها بتحميل محتوى حقيقي)
            const pageName = this.querySelector('span').textContent;
            showNotification(`تم النقر على: ${pageName} - جاري التطوير...`);
        });
    });
    
    // تأثيرات بطاقات الإحصائيات
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // محاكاة بيانات حية (في التطبيق الحقيقي، ستأتي من API)
    function simulateLiveData() {
        const stats = [
            { element: '.stat-card.revenue .stat-number', value: '$12,450' },
            { element: '.stat-card.orders .stat-number', value: '156' },
            { element: '.stat-card.customers .stat-number', value: '48' },
            { element: '.stat-card.growth .stat-number', value: '23.5%' }
        ];
        
        // تأثير عد متحرك للقيم (يمكن تفعيله لاحقاً)
        stats.forEach(stat => {
            const element = document.querySelector(stat.element);
            if (element) {
                // يمكن إضافة تأثير عد متحرك هنا
                element.textContent = stat.value;
            }
        });
    }
    
    // وظيفة عرض الإشعارات
    function showNotification(message) {
        // إنشاء عنصر الإشعار
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: var(--primary-color);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // إظهار الإشعار
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // إخفاء الإشعار بعد 3 ثوان
        setTimeout(() => {
            notification.style.transform = 'translateX(-100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    // وظيفة البحث (يمكن تطويرها)
    const searchInput = document.querySelector('.search-container input');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            if (searchTerm.length > 2) {
                console.log(`البحث عن: ${searchTerm}`);
                // هنا يمكن إضافة وظيفة البحث الفعلية
            }
        });
    }
    
    // تهيئة البيانات
    simulateLiveData();
    
    // رسالة ترحيب
    setTimeout(() => {
        showNotification('مرحباً بك في نظام لحظة فن! 🎨');
    }, 1000);
    
    // إضافة تأثيرات إضافية للجدول
    const tableRows = document.querySelectorAll('.orders-table tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('click', function() {
            const orderId = this.querySelector('.order-id').textContent;
            showNotification(`تم اختيار الطلب: ${orderId}`);
        });
    });
});