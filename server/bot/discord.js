const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { generatePaymentProof } = require('../utils/paymentProof');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let isReady = false;

client.once('ready', () => {
  console.log(`🤖 Discord Bot logged in as ${client.user.tag}`);
  isReady = true;
});

// ─── SEND WITHDRAWAL NOTIFICATION ───
async function sendWithdrawalNotification(withdrawal, user) {
  if (!isReady) {
    console.warn('Bot not ready, skipping notification');
    return;
  }

  try {
    const channel = await client.channels.fetch(process.env.DISCORD_ADMIN_CHANNEL_ID);
    if (!channel) {
      console.error('Admin channel not found');
      return;
    }

    const ltcAmount = (withdrawal.amountPoints * 0.00001).toFixed(6);

    const embed = new EmbedBuilder()
      .setTitle('💰 New Withdrawal Request')
      .setColor(withdrawal.method === 'LTC' ? 0xF7931A : 0x4CAF50)
      .addFields(
        { name: '👤 User', value: user.email, inline: true },
        { name: '🎮 Discord', value: user.discord?.username || 'N/A', inline: true },
        { name: '🆔 User ID', value: user._id.toString(), inline: false },
        { name: '💎 Points', value: withdrawal.amountPoints.toLocaleString(), inline: true },
        { name: '🪙 LTC Value', value: `${ltcAmount} LTC`, inline: true },
        { name: '📋 Method', value: withdrawal.method, inline: true },
        { name: '📨 Destination', value: `\`${withdrawal.destination}\``, inline: false },
        { name: '📅 Requested', value: new Date().toLocaleString(), inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Withdrawal ID: ${withdrawal._id}` });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${withdrawal._id}`)
          .setLabel('✅ Approve')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_${withdrawal._id}`)
          .setLabel('❌ Reject')
          .setStyle(ButtonStyle.Danger)
      );

    const message = await channel.send({ embeds: [embed], components: [row] });

    // Store the message ID on the withdrawal for reference
    withdrawal.discordMessageId = message.id;
    await withdrawal.save();
  } catch (error) {
    console.error('Discord notification error:', error);
  }
}

// ─── INTERACTION HANDLER (Buttons + Modals) ───
client.on('interactionCreate', async (interaction) => {

  // ═══ BUTTON INTERACTIONS ═══
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // --- Withdrawal approve/reject buttons ---
    if (customId.startsWith('approve_') || customId.startsWith('reject_')) {
      const [action, withdrawalId] = customId.split('_');
      try {
        const withdrawal = await Withdrawal.findById(withdrawalId);
        if (!withdrawal) {
          return interaction.reply({ content: '❌ Withdrawal not found.', ephemeral: true });
        }
        if (withdrawal.status !== 'pending') {
          return interaction.reply({ content: '⚠️ This withdrawal has already been processed.', ephemeral: true });
        }

        if (action === 'approve') {
          withdrawal.status = 'approved';
          withdrawal.processedBy = interaction.user.tag;
          await withdrawal.save();
          await Transaction.findOneAndUpdate(
            { userId: withdrawal.userId, type: 'withdrawal', status: 'pending' },
            { status: 'completed' }
          );
          const embed = new EmbedBuilder()
            .setTitle('✅ Withdrawal APPROVED')
            .setColor(0x22C55E)
            .setDescription(`Approved by **${interaction.user.tag}**`)
            .addFields(
              { name: '💎 Points', value: withdrawal.amountPoints.toLocaleString(), inline: true },
              { name: '📋 Method', value: withdrawal.method, inline: true },
              { name: '📨 Destination', value: `\`${withdrawal.destination}\``, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Withdrawal ID: ${withdrawal._id}` });
          await interaction.update({ embeds: [embed], components: [] });

          // Post payment proof
          const approvedUser = await User.findById(withdrawal.userId);
          if (approvedUser) {
            await sendPaymentProof(withdrawal, approvedUser);
          }
        } else {
          withdrawal.status = 'rejected';
          withdrawal.processedBy = interaction.user.tag;
          await withdrawal.save();
          await User.findByIdAndUpdate(withdrawal.userId, {
            $inc: { points: withdrawal.amountPoints }
          });
          await Transaction.findOneAndUpdate(
            { userId: withdrawal.userId, type: 'withdrawal', status: 'pending' },
            { status: 'rejected' }
          );
          await Transaction.create({
            userId: withdrawal.userId,
            type: 'admin_adjust',
            points: withdrawal.amountPoints,
            status: 'completed',
            details: 'Withdrawal rejected — points refunded'
          });
          const embed = new EmbedBuilder()
            .setTitle('❌ Withdrawal REJECTED')
            .setColor(0xEF4444)
            .setDescription(`Rejected by **${interaction.user.tag}** — Points refunded.`)
            .addFields(
              { name: '💎 Points Refunded', value: withdrawal.amountPoints.toLocaleString(), inline: true },
              { name: '📋 Method', value: withdrawal.method, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Withdrawal ID: ${withdrawal._id}` });
          await interaction.update({ embeds: [embed], components: [] });
        }
      } catch (error) {
        console.error('Button interaction error:', error);
        interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
      }
      return;
    }

    // --- Admin Dashboard Buttons ---
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '🔒 You need Administrator permissions.', ephemeral: true });
    }

    if (customId === 'admin_stats') {
      try {
        const totalUsers = await User.countDocuments();
        const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
        const bannedUsers = await User.countDocuments({ isBanned: true });

        const totalPointsResult = await Transaction.aggregate([
          { $match: { type: { $ne: 'withdrawal' }, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$points' } } }
        ]);
        const totalPoints = totalPointsResult[0]?.total || 0;

        const totalWithdrawnResult = await Withdrawal.aggregate([
          { $match: { status: 'approved' } },
          { $group: { _id: null, total: { $sum: '$amountPoints' } } }
        ]);
        const totalWithdrawn = totalWithdrawnResult[0]?.total || 0;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const newUsersToday = await User.countDocuments({ createdAt: { $gte: todayStart } });

        const embed = new EmbedBuilder()
          .setTitle('📊 EasyEarn Admin Stats')
          .setColor(0x7c3aed)
          .addFields(
            { name: '👥 Total Users', value: totalUsers.toLocaleString(), inline: true },
            { name: '🆕 New Today', value: newUsersToday.toLocaleString(), inline: true },
            { name: '🚫 Banned', value: bannedUsers.toLocaleString(), inline: true },
            { name: '💎 Points Distributed', value: totalPoints.toLocaleString(), inline: true },
            { name: '💸 Total Withdrawn', value: `${totalWithdrawn.toLocaleString()} pts`, inline: true },
            { name: '⏳ Pending Withdrawals', value: pendingWithdrawals.toLocaleString(), inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'EasyEarn Admin Panel' });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error('Admin stats error:', error);
        return interaction.reply({ content: '❌ Failed to fetch stats.', ephemeral: true });
      }
    }

    if (customId === 'admin_lookup') {
      const modal = new ModalBuilder()
        .setCustomId('modal_lookup')
        .setTitle('🔍 User Lookup');
      const emailInput = new TextInputBuilder()
        .setCustomId('lookup_email')
        .setLabel('User Email')
        .setPlaceholder('user@example.com')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
      return interaction.showModal(modal);
    }

    if (customId === 'admin_adjust') {
      const modal = new ModalBuilder()
        .setCustomId('modal_adjust')
        .setTitle('💰 Adjust User Balance');
      const emailInput = new TextInputBuilder()
        .setCustomId('adjust_email')
        .setLabel('User Email')
        .setPlaceholder('user@example.com')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      const pointsInput = new TextInputBuilder()
        .setCustomId('adjust_points')
        .setLabel('Points (use - for deduction)')
        .setPlaceholder('500 or -200')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      const reasonInput = new TextInputBuilder()
        .setCustomId('adjust_reason')
        .setLabel('Reason')
        .setPlaceholder('Bonus reward / correction')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
      modal.addComponents(
        new ActionRowBuilder().addComponents(emailInput),
        new ActionRowBuilder().addComponents(pointsInput),
        new ActionRowBuilder().addComponents(reasonInput)
      );
      return interaction.showModal(modal);
    }

    if (customId === 'admin_ban') {
      const modal = new ModalBuilder()
        .setCustomId('modal_ban')
        .setTitle('🚫 Ban / Unban User');
      const emailInput = new TextInputBuilder()
        .setCustomId('ban_email')
        .setLabel('User Email')
        .setPlaceholder('user@example.com')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
      return interaction.showModal(modal);
    }
  }

  // ═══ MODAL SUBMISSIONS ═══
  if (interaction.isModalSubmit()) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '🔒 You need Administrator permissions.', ephemeral: true });
    }

    const modalId = interaction.customId;

    // --- User Lookup ---
    if (modalId === 'modal_lookup') {
      const email = interaction.fields.getTextInputValue('lookup_email').trim().toLowerCase();
      try {
        const user = await User.findOne({ email });
        if (!user) {
          return interaction.reply({ content: `❌ No user found with email: \`${email}\``, ephemeral: true });
        }
        const embed = new EmbedBuilder()
          .setTitle('👤 User Details')
          .setColor(0x06b6d4)
          .addFields(
            { name: '📧 Email', value: user.email, inline: true },
            { name: '🆔 ID', value: user._id.toString(), inline: true },
            { name: '🎮 Discord', value: user.discord?.username || 'Not linked', inline: true },
            { name: '💎 Points', value: user.points.toLocaleString(), inline: true },
            { name: '🪙 LTC Value', value: `${(user.points * 0.00001).toFixed(6)} LTC`, inline: true },
            { name: '🚫 Banned', value: user.isBanned ? '**YES**' : 'No', inline: true },
            { name: '🔗 Referral Code', value: `\`${user.referralCode}\``, inline: true },
            { name: '📅 Joined', value: user.createdAt.toLocaleDateString(), inline: true },
            { name: '👑 Admin', value: user.isAdmin ? '**YES**' : 'No', inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'EasyEarn Admin Panel' });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error('Lookup error:', error);
        return interaction.reply({ content: '❌ Lookup failed.', ephemeral: true });
      }
    }

    // --- Adjust Balance ---
    if (modalId === 'modal_adjust') {
      const email = interaction.fields.getTextInputValue('adjust_email').trim().toLowerCase();
      const pointsStr = interaction.fields.getTextInputValue('adjust_points').trim();
      const reason = interaction.fields.getTextInputValue('adjust_reason')?.trim() || 'Admin adjustment via Discord';
      const points = parseInt(pointsStr);

      if (isNaN(points) || points === 0) {
        return interaction.reply({ content: '❌ Invalid points value. Use a number like `500` or `-200`.', ephemeral: true });
      }

      try {
        const user = await User.findOne({ email });
        if (!user) {
          return interaction.reply({ content: `❌ No user found with email: \`${email}\``, ephemeral: true });
        }

        const oldBalance = user.points;
        user.points = Math.max(0, user.points + points);
        await user.save();

        await Transaction.create({
          userId: user._id,
          type: 'admin_adjust',
          points: points,
          status: 'completed',
          details: `${reason} (by ${interaction.user.tag})`
        });

        const embed = new EmbedBuilder()
          .setTitle(points > 0 ? '✅ Points Added' : '⚠️ Points Deducted')
          .setColor(points > 0 ? 0x22c55e : 0xeab308)
          .addFields(
            { name: '📧 User', value: email, inline: true },
            { name: '💰 Change', value: `${points > 0 ? '+' : ''}${points.toLocaleString()} pts`, inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: '📊 Old Balance', value: oldBalance.toLocaleString(), inline: true },
            { name: '📊 New Balance', value: user.points.toLocaleString(), inline: true },
            { name: '📝 Reason', value: reason, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: `Adjusted by ${interaction.user.tag}` });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error('Adjust balance error:', error);
        return interaction.reply({ content: '❌ Failed to adjust balance.', ephemeral: true });
      }
    }

    // --- Ban / Unban ---
    if (modalId === 'modal_ban') {
      const email = interaction.fields.getTextInputValue('ban_email').trim().toLowerCase();
      try {
        const user = await User.findOne({ email });
        if (!user) {
          return interaction.reply({ content: `❌ No user found with email: \`${email}\``, ephemeral: true });
        }

        user.isBanned = !user.isBanned;
        await user.save();

        const embed = new EmbedBuilder()
          .setTitle(user.isBanned ? '🚫 User BANNED' : '✅ User UNBANNED')
          .setColor(user.isBanned ? 0xef4444 : 0x22c55e)
          .addFields(
            { name: '📧 Email', value: user.email, inline: true },
            { name: '🆔 ID', value: user._id.toString(), inline: true },
            { name: '📌 Status', value: user.isBanned ? '🔴 Banned' : '🟢 Active', inline: true }
          )
          .setTimestamp()
          .setFooter({ text: `Action by ${interaction.user.tag}` });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (error) {
        console.error('Ban toggle error:', error);
        return interaction.reply({ content: '❌ Failed to update ban status.', ephemeral: true });
      }
    }
  }
});

// ─── COMMANDS (messageCreate) ───
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const cmd = message.content.toLowerCase().trim();

  // ─── !ping ───
  if (cmd === '!ping') {
    const sent = await message.channel.send('🏓 Pinging...');
    const botPing = sent.createdTimestamp - message.createdTimestamp;
    const wsPing = Math.round(client.ws.ping);

    const clientUrl = process.env.CLIENT_URL || 'https://easyearn-zxob.onrender.com';
    let websitePing = 'N/A';
    let websiteStatus = '❌ Down';
    try {
      const start = Date.now();
      const res = await axios.get(clientUrl, { timeout: 8000 });
      websitePing = `${Date.now() - start}ms`;
      websiteStatus = res.status === 200 ? '✅ Online' : `⚠️ ${res.status}`;
    } catch {
      websiteStatus = '❌ Unreachable';
    }

    let apiPing = 'N/A';
    let apiStatus = '❌ Down';
    const apiBase = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    try {
      const start = Date.now();
      const res = await axios.get(`${apiBase}/health`, { timeout: 5000 });
      apiPing = `${Date.now() - start}ms`;
      apiStatus = res.data?.status === 'ok' ? '✅ Online' : `⚠️ ${res.status}`;
    } catch {
      apiStatus = '❌ Unreachable';
    }

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(botPing < 200 ? 0x22c55e : botPing < 500 ? 0xeab308 : 0xef4444)
      .addFields(
        { name: '🤖 Bot Latency', value: `${botPing}ms`, inline: true },
        { name: '📡 WebSocket', value: `${wsPing}ms`, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '🌐 Website', value: `${websiteStatus} (${websitePing})`, inline: true },
        { name: '⚙️ API', value: `${apiStatus} (${apiPing})`, inline: true },
        { name: '\u200b', value: '\u200b', inline: true }
      )
      .setFooter({ text: 'EasyEarn Status Check' })
      .setTimestamp();

    await sent.edit({ content: null, embeds: [embed] });
    return;
  }

  // ─── !admin ───
  if (cmd === '!admin') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('🔒 You need **Administrator** permissions to use this command.');
    }

    const embed = new EmbedBuilder()
      .setTitle('🛡️ EasyEarn Admin Panel')
      .setColor(0x7c3aed)
      .setDescription('Welcome, Admin! Use the buttons below to manage the platform.')
      .addFields(
        { name: '📊 Stats', value: 'View platform statistics', inline: true },
        { name: '🔍 Lookup', value: 'Search user by email', inline: true },
        { name: '💰 Adjust', value: 'Add or deduct points', inline: true },
        { name: '🚫 Ban/Unban', value: 'Toggle user ban status', inline: true }
      )
      .setFooter({ text: 'Admin actions are logged • EasyEarn' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_stats')
        .setLabel('📊 Stats')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_lookup')
        .setLabel('🔍 Lookup User')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_adjust')
        .setLabel('💰 Adjust Balance')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('admin_ban')
        .setLabel('🚫 Ban / Unban')
        .setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row1] });
    return;
  }
});

// ─── LIVE EARNINGS NOTIFICATION (#live-earnings) ───
// Posts when a user completes a high-paying offer (>1,000 points)
async function sendLiveEarningNotification(user, points, offerName) {
  if (!isReady) return;

  const channelId = process.env.DISCORD_LIVE_EARNINGS_CHANNEL_ID;
  if (!channelId || channelId === 'your_live_earnings_channel_id') return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;

    const maskedEmail = maskEmailForDisplay(user.email);
    const ltcValue = (points * 0.00001).toFixed(5);

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('🎉 Someone Just Earned Big!')
      .setDescription(
        `**${maskedEmail}** just completed a task on RevToo and earned **${points.toLocaleString()} Points** (~${ltcValue} LTC)!`
      )
      .addFields(
        { name: '📋 Task', value: offerName || 'Offer Completed', inline: true },
        { name: '💎 Points Earned', value: points.toLocaleString(), inline: true },
        { name: '🪙 LTC Value', value: `${ltcValue} LTC`, inline: true }
      )
      .setFooter({ text: '💡 Start earning now at EasyEarn.com!' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`Live earnings posted: ${maskedEmail} earned ${points} pts`);
  } catch (error) {
    console.error('Live earnings notification error:', error.message);
  }
}

// ─── PAYMENT PROOF (#payment-proofs) ───
// Posts a generated image when admin approves a withdrawal
async function sendPaymentProof(withdrawal, user) {
  if (!isReady) return;

  const channelId = process.env.DISCORD_PAYMENT_PROOFS_CHANNEL_ID;
  if (!channelId || channelId === 'your_payment_proofs_channel_id') return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;

    const ltcAmount = (withdrawal.amountPoints * 0.00001).toFixed(6);

    // Generate the payment proof image
    const imageBuffer = await generatePaymentProof({
      username: user.email,
      amount: withdrawal.amountPoints,
      method: withdrawal.method,
      destination: withdrawal.destination,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
      withdrawalId: withdrawal._id
    });

    const attachment = new AttachmentBuilder(imageBuffer, { name: 'payment-proof.png' });

    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('💸 Payment Sent Successfully!')
      .setDescription(
        `A withdrawal of **${ltcAmount} LTC** (${withdrawal.amountPoints.toLocaleString()} Points) has been processed and sent!`
      )
      .setImage('attachment://payment-proof.png')
      .addFields(
        { name: '🪙 Amount', value: `${ltcAmount} LTC`, inline: true },
        { name: '📋 Method', value: withdrawal.method, inline: true },
        { name: '✅ Status', value: 'Completed', inline: true }
      )
      .setFooter({ text: '🔒 All payments are verified • EasyEarn.com' })
      .setTimestamp();

    await channel.send({ embeds: [embed], files: [attachment] });
    console.log(`Payment proof posted for withdrawal ${withdrawal._id}`);
  } catch (error) {
    console.error('Payment proof notification error:', error.message);
  }
}

// ─── HELPER: Mask email for privacy ───
function maskEmailForDisplay(email) {
  if (!email || !email.includes('@')) return '***@***.***';
  const [name, domain] = email.split('@');
  const masked = name.slice(0, 2) + '***' + (name.length > 2 ? name.slice(-1) : '');
  return `${masked}@${domain}`;
}

// ─── LOGIN BOT ───
function startBot() {
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_BOT_TOKEN !== 'your_discord_bot_token') {
    client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
      console.error('Discord bot login failed:', err.message);
    });
  } else {
    console.warn('⚠️ Discord bot token not configured. Bot disabled.');
  }
}

module.exports = { client, startBot, sendWithdrawalNotification, sendLiveEarningNotification, sendPaymentProof };
