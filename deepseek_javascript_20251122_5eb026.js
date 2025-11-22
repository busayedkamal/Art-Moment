// كود جافاسكريبت للوظائف التفاعلية
document.addEventListener('DOMContentLoaded', function() {
    
    // تفعيل الروابط في القائمة الجانبية
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // هنا يمكنك إضافة كود لتحميل المحتوى الديناميكي
            console.log('تم النقر على: ' + this.textContent);
        });
    });

    // محاكاة تحميل البيانات (يمكن استبدالها بطلبات AJAX فعلية لخادم)
    function loadDashboardData() {
        console.log('جاري تحميل بيانات لوحة التحكم...');
        // في التطبيق الحقيقي، هنا ستجلب البيانات من خادم API
    }

    // تهيئة التطبيق
    loadDashboardData();
});