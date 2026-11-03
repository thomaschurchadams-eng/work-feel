// Approved house promotions use the same queue/executor, with an explicit identity.
const DEFAULT = require('../automation/house-campaign.json');
function validateHouseItem(item, campaign = DEFAULT) {
  if (campaign.status !== 'approved' || !campaign.approvalReference || item.campaignId !== campaign.id) return 'house_campaign_not_approved';
  const approved = campaign.preparedItems.find(candidate => candidate.id === item.id);
  if (!approved || approved.status !== 'prepared') return 'house_campaign_item_not_prepared';
  for (const key of ['platform', 'contentKind', 'campaignId', 'articleUrl', 'distributionUrl', 'trackingStatus', 'imageUrl', 'imageAlt', 'copy']) {
    if (item[key] !== approved[key]) return 'house_campaign_package_mismatch';
  }
  if (item.mediaType && item.mediaType !== 'image') return 'house_campaign_image_only';
  if (item.timingExperimentId) return 'house_campaign_fixed_time_required';
  return null;
}
function preparedHouseItems(campaign = DEFAULT) {
  return campaign.preparedItems.filter(item => !validateHouseItem(item, campaign));
}
module.exports = { validateHouseItem, preparedHouseItems };
