const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const cors = require('../middleware/cors');

/**
 * Authenticate kiosk and generate custom token
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const kioskLogin = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const { kioskId, accessCode } = req.body;

      // Validate input
      if (!kioskId || !accessCode) {
        return res.status(400).send({
          error: 'kioskId and accessCode are required',
        });
      }

      // Fetch kiosk document
      const kioskRef = admin.firestore().collection('kiosks').doc(kioskId);
      const kioskDoc = await kioskRef.get();

      if (!kioskDoc.exists) {
        return res.status(401).send({
          error: 'Invalid kiosk credentials',
        });
      }

      const kioskData = kioskDoc.data();

      // Verify kiosk status is online
      if (kioskData.status !== 'online') {
        return res.status(403).send({
          error: 'Kiosk is not online',
        });
      }

      // Verify access code
      if (kioskData.accessCode !== accessCode) {
        return res.status(401).send({
          error: 'Invalid kiosk credentials',
        });
      }

      // Generate custom token with kiosk UID format
      const uid = `kiosk:${kioskId}`;

      // Fetch organization currency if available
      let organizationCurrency = 'GBP';
      if (kioskData.organizationId) {
        const orgDoc = await admin
          .firestore()
          .collection('organizations')
          .doc(kioskData.organizationId)
          .get();
        if (orgDoc.exists) {
          organizationCurrency = orgDoc.data().currency || 'GBP';
        }
      }

      // Set custom claims with all necessary kiosk data
      const customClaims = {
        role: 'kiosk',
        kioskId: kioskId,
        kioskName: kioskData.name,
        organizationId: kioskData.organizationId || null,
        organizationCurrency: organizationCurrency,
        assignedCampaigns: kioskData.assignedCampaigns || [],
        settings: kioskData.settings || {
          displayMode: 'grid',
          showAllCampaigns: false,
          maxCampaignsDisplay: 6,
          autoRotateCampaigns: false,
        },
      };

      // Create custom token
      const customToken = await admin.auth().createCustomToken(uid, customClaims);

      // Update last active timestamp
      await kioskRef.update({
        lastActive: FieldValue.serverTimestamp(),
      });

      return res.status(200).send({
        success: true,
        token: customToken,
        kioskData: {
          id: kioskId,
          name: kioskData.name,
          organizationId: kioskData.organizationId,
          assignedCampaigns: kioskData.assignedCampaigns || [],
          settings: kioskData.settings || {
            displayMode: 'grid',
            showAllCampaigns: false,
            maxCampaignsDisplay: 6,
            autoRotateCampaigns: false,
          },
        },
      });
    } catch (error) {
      console.error('Error in kioskLogin:', error);
      return res.status(500).send({
        error: error.message || 'Failed to authenticate kiosk',
      });
    }
  });
};

module.exports = {
  kioskLogin,
};
