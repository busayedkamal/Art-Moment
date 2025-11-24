// تطبيق لحظة فن - Art Moment
console.log('🚀 تطبيق لحظة فن يعمل بنجاح!');

// كود بسيط للتأكد من العمل
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ تم تحميل الصفحة بنجاح');
    
    // تفعيل القائمة الجانبية
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('النقر على: ' + this.textContent);
            
            // إزالة النشاط من جميع الروابط
            navLinks.forEach(l => l.classList.remove('active'));
            // إضافة النشاط للرابط المختار
            this.classList.add('active');
            
            alert('جاري التطوير: ' + this.textContent);
        });
    });
    
    // إظهار رسالة ترحيب
    setTimeout(() => {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: #10b981;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1001;
        `;
        notification.textContent = 'مرحباً بك في نظام لحظة فن! 🎨';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }, 1000);
});

// جعل الكائن متاحاً globally
window.app = {
    version: '1.0.0',
    navigateTo: function(page) {
        console.log('التنقل إلى: ' + page);
        alert('جاري التطوير: ' + page);
    }
};
