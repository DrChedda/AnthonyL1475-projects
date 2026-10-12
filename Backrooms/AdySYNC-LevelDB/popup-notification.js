(function() {
    const container = document.querySelector('#popupNotifications');
    if (!container) return;

    let nextNotificationId = 0;
    const timers = new Map();

    function show(message, { type = 'info', duration = 5000 } = {}) {
        if (typeof message !== 'string' || !message.trim()) {
            throw new TypeError('Popup notifications require a non-empty message.');
        }

        if (!['info', 'success', 'warning', 'error'].includes(type)) {
            throw new TypeError(`Unknown popup notification type: ${type}`);
        }

        const id = ++nextNotificationId;
        const notification = document.createElement('div');
        notification.className = `popup-notification popup-notification--${type}`;
        notification.setAttribute('role', type === 'error' ? 'alert' : 'status');

        const text = document.createElement('span');
        text.className = 'popup-notification__message';
        text.textContent = message;

        const dismissButton = document.createElement('button');
        dismissButton.className = 'popup-notification__dismiss';
        dismissButton.type = 'button';
        dismissButton.setAttribute('aria-label', 'Dismiss notification');

        const dismiss = () => {
            const timer = timers.get(id);
            if (timer !== undefined) {
                clearTimeout(timer);
                timers.delete(id);
            }
            notification.remove();
        };

        dismissButton.addEventListener('click', dismiss);
        notification.append(text, dismissButton);
        container.appendChild(notification);

        if (type !== 'error' && type !== 'warning') {
            const timer = setTimeout(dismiss, Math.max(0, duration));
            timers.set(id, timer);
        }

        return id;
    }

    window.PopupNotification = Object.freeze({ show });

    window.addEventListener('error', event => {
        const message = event.message || event.error?.message || 'An unexpected error occurred.';
        show(message, { type: 'error' });
    });

    window.addEventListener('unhandledrejection', event => {
        const reason = event.reason;
        const message = reason instanceof Error ? reason.message : String(reason ?? 'Unknown error');
        show(`Unhandled error: ${message}`, { type: 'error' });
    });
})();
