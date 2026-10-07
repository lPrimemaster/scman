// Prints a new VAPID key pair for Web Push. Put the values in backend/.env.
// Changing the keys invalidates every existing browser subscription.
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:admin@sc1925.pt');
