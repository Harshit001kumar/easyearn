const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
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

module.exports = { client, startBot, sendWithdrawalNotification };
