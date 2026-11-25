/**
 * Dynamically ensures Razorpay Checkout SDK (https://checkout.razorpay.com/v1/checkout.js)
 * is loaded and ready on window.Razorpay before initiating live transactions.
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      return resolve(true);
    }

    const src = 'https://checkout.razorpay.com/v1/checkout.js';
    const existingScript = document.querySelector(`script[src="${src}"]`);

    if (existingScript) {
      // Wait briefly if index.html tag is still downloading
      let elapsed = 0;
      const interval = setInterval(() => {
        if (window.Razorpay) {
          clearInterval(interval);
          resolve(true);
        } else if (elapsed >= 4000) {
          clearInterval(interval);
          resolve(false);
        }
        elapsed += 100;
      }, 100);
      existingScript.addEventListener('error', () => {
        clearInterval(interval);
        resolve(false);
      });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};
