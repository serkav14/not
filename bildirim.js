const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID
});
const db = admin.firestore();
const messaging = admin.messaging();
async function bildirimGonder() {
  const wsSnap = await db.collection('workspaces').get();
  for (const wsDoc of wsSnap.docs) {
    const wsId = wsDoc.id;
    const bildirimSnap = await db
      .collection('workspaces').doc(wsId)
      .collection('bildirimler')
      .where('okundu', '==', false)
      .where('gonderildi', '==', false)
      .limit(20)
      .get();
    if (bildirimSnap.empty) continue;
    for (const bildirimDoc of bildirimSnap.docs) {
      const bildirim = bildirimDoc.data();
      const hedefUid = bildirim.hedefUid;
      if (!hedefUid) { await bildirimDoc.ref.update({ gonderildi: true }); continue; }
      const memberSnap = await db
        .collection('workspaces').doc(wsId)
        .collection('members')
        .where('uid', '==', hedefUid)
        .limit(1)
        .get();
      if (memberSnap.empty) { await bildirimDoc.ref.update({ gonderildi: true }); continue; }
      const fcmToken = memberSnap.docs[0].data().fcmToken;
      if (!fcmToken) { await bildirimDoc.ref.update({ gonderildi: true }); continue; }
      try {
        await messaging.send({
          token: fcmToken,
          notification: { title: bildirim.baslik || 'Yeni bildirim', body: bildirim.mesaj || '' },
          android: { priority: 'high', notification: { sound: 'default', channelId: 'vardiya_kanal' } }
        });
        console.log('Gonderildi:', hedefUid);
      } catch (err) {
        console.error('Hata:', err.message);
      }
      await bildirimDoc.ref.update({ gonderildi: true });
    }
  }
  console.log('Tamamlandi.');
}
bildirimGonder().catch(console.error);
