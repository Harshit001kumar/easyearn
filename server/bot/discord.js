const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
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

// ─── BUTTON INTERACTION HANDLER ───
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, withdrawalId] = interaction.customId.split('_');

  if (!['approve', 'reject'].includes(action)) return;

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

      // Update transaction
      await Transaction.findOneAndUpdate(
        { userId: withdrawal.userId, type: 'withdrawal', status: 'pending' },
        { status: 'completed' }
      );

      // Update the embed
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

      // Post payment proof to #payment-proofs channel
      const approvedUser = await User.findById(withdrawal.userId);
      if (approvedUser) {
        await sendPaymentProof(withdrawal, approvedUser);
      }
    } else {
      // Reject — refund points
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
    interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
  }
});

// ─── PING COMMAND ───
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() !== '!ping') return;

  const sent = await message.channel.send('🏓 Pinging...');

  // Bot latency
  const botPing = sent.createdTimestamp - message.createdTimestamp;
  const wsPing = Math.round(client.ws.ping);

  // Website ping
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

  // API ping (self-check)
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
