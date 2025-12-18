import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  Routes
} from "discord.js";
import { REST } from "@discordjs/rest";
import dotenv from "dotenv";
dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const TZ = process.env.TIMEZONE || "Asia/Bangkok";
const MEMBER_ROLE = process.env.MEMBER_ROLE;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName("setstats")
    .setDescription("สร้างสถิติสมาชิกและบอททั้งเซิร์ฟ (เฉพาะเจ้าของ)")
    .addStringOption(opt =>
      opt.setName("type")
        .setDescription("เลือกรูปแบบห้อง")
        .setRequired(true)
        .addChoices(
          { name: "ห้องแชทปกติ", value: "text" },
          { name: "ห้องเสียง", value: "voice" }
        )
    )
].map(c =>
  c.setDefaultMemberPermissions(PermissionFlagsBits.Administrator).toJSON()
);

client.once("ready", async () => {
  console.log(`🟢 Bot Online: ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  for (const [gid] of client.guilds.cache)
    await rest.put(Routes.applicationGuildCommands(client.user.id, gid), {
      body: commands
    });
});

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.user.id !== ADMIN_ID)
    return i.reply({ content: "❌ ไม่อนุญาต", ephemeral: true });

  if (i.commandName === "setstats") {
    const type = i.options.getString("type");
    const baseType = (name) =>
      type === "voice"
        ? { type: ChannelType.GuildVoice, name }
        : { type: ChannelType.GuildText, name };

    const totalMembers = await i.guild.members.fetch();
    const bots = totalMembers.filter((m) => m.user.bot).size;
    const humans = totalMembers.filter((m) => !m.user.bot).size;

    const online = totalMembers.filter((m) => m.presence?.status === "online");
    const offline = totalMembers.filter((m) => !m.presence?.status);

    // Create Category
    const category = await i.guild.channels.create({
      name: "📊│สถิติสมาชิกทั้งหมด",
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: i.guild.roles.everyone,
          allow: ["ViewChannel"],
          deny: ["SendMessages", "Connect"]
        },
        {
          id: MEMBER_ROLE,
          allow: ["ViewChannel"],
          deny: ["SendMessages", "Connect"]
        }
      ]
    });

    const config = {
      parent: category.id,
      permissionOverwrites: [
        {
          id: i.guild.roles.everyone,
          allow: ["ViewChannel"],
          deny: ["SendMessages", "Connect"]
        },
        {
          id: MEMBER_ROLE,
          allow: ["ViewChannel"],
          deny: ["SendMessages", "Connect"]
        }
      ]
    };

    await i.guild.channels.create({
      ...config,
      ...baseType(`🤖│จำนวนบอท : ${bots}`)
    });
    await i.guild.channels.create({
      ...config,
      ...baseType(`👤│สมาชิกที่อยู่ในเซิร์ฟ : ${humans}`)
    });
    await i.guild.channels.create({
      ...config,
      ...baseType(`♻️│สมาชิก & บอท รวมทั้งหมด : ${humans + bots}`)
    });
    await i.guild.channels.create({
      ...config,
      ...baseType(`🟢│ออนไลน์ตอนนี้ : ${online.size}`)
    });
    await i.guild.channels.create({
      ...config,
      ...baseType(`🔴│ออฟไลน์ตอนนี้ : ${offline.size}`)
    });

    return i.reply(`🟢 สร้างห้องสถิติแบบ **${type}** แล้วค้าบ`);
  }
});

// Update 5 min
setInterval(async () => {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === "📊│สถิติสมาชิกทั้งหมด"
  );
  if (!category) return;

  const totalMembers = await guild.members.fetch();
  const bots = totalMembers.filter((m) => m.user.bot).size;
  const humans = totalMembers.filter((m) => !m.user.bot).size;
  const online = totalMembers.filter((m) => m.presence?.status === "online");
  const offline = totalMembers.filter((m) => !m.presence?.status);

  const channels = guild.channels.cache.filter(
    (c) => c.parentId === category.id
  );

  const sorted = [...channels.values()].sort((a, b) => a.position - b.position);

  if (sorted[0]) sorted[0].setName(`🤖│จำนวนบอท : ${bots}`).catch(() => {});
  if (sorted[1]) sorted[1].setName(`👤│สมาชิกที่อยู่ในเซิร์ฟ : ${humans}`).catch(() => {});
  if (sorted[2])
    sorted[2]
      .setName(`♻️│สมาชิก & บอท รวมทั้งหมด : ${humans + bots}`)
      .catch(() => {});
  if (sorted[3]) sorted[3].setName(`🟢│ออนไลน์ตอนนี้ : ${online.size}`).catch(() => {});
  if (sorted[4]) sorted[4].setName(`🔴│ออฟไลน์ตอนนี้ : ${offline.size}`).catch(() => {});

  console.log("♻️ อัปเดตทุก 5 นาทีแล้วค้าบ");
}, 5 * 60 * 1000);

client.login(TOKEN);
