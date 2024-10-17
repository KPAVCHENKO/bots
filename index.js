const tmi = require('tmi.js');
const fs = require('fs');
const si = require('systeminformation');
const config = require('./config');

// Создание клиента
const client = new tmi.Client({
    identity: {
        username: config.identity.username,
        password: config.identity.password
    },
    channels: [config.twitch.channelName]
});

// Загрузка списка каналов из файла
function loadChannels() {
    try {
        const data = fs.readFileSync(config.channelsFile, 'utf8');
        return data.trim().split('\n').filter(Boolean);
    } catch (err) {
        console.error(`Ошибка загрузки файла каналов: ${err}`);
        return [];
    }
}

// Сохранение списка каналов в файл
function saveChannels(channels) {
    try {
        fs.writeFileSync(config.channelsFile, channels.join('\n'), 'utf8');
        console.log(`Список каналов успешно сохранен в файл.`);
    } catch (err) {
        console.error(`Ошибка при сохранении файла каналов: ${err}`);
    }
}

// Функция для форматирования времени из миллисекунд в формат 'мм:сс'
function formatTime(time) {
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Форматирование времени работы
function formatUptime(uptime) {
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Форматирование использования памяти
function formatMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    return `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB RSS, ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB Heap, ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB Used`;
}

// Подключение к каналам
async function joinChannels(channels) {
    for (const channel of channels) {
        try {
            await client.join(channel);
            console.log(`Присоединился к каналу ${channel}`);
        } catch (err) {
            console.error(`Ошибка при присоединении к каналу ${channel}: ${err}`);
        }
    }
}

// Отключение от каналов
async function partChannels(channels) {
    for (const channel of channels) {
        try {
            await client.part(channel);
            console.log(`Отключился от канала ${channel}`);
        } catch (err) {
            console.error(`Ошибка при отключении от канала ${channel}: ${err}`);
        }
    }
}

// Функция для отправки сообщений в чат
function sendMessage(channel, message) {
    client.say(channel, message).catch(err => {
        console.error(`Ошибка при отправке сообщения в канал ${channel}: ${err}`);
    });
}

// Функция для изменения префикса команды
function changePrefix(channel, newPrefix, senderIsMod) {
    if (!senderIsMod) {
        console.log(`Доступ запрещен: ${senderIsMod}`);
        return `Доступ запрещен. Вы не модератор.`;
    }

    // Устанавливаем новый префикс для канала
    config.channelPrefixes[channel] = newPrefix;

    // Сохраняем обновленную конфигурацию в файл
    saveConfigToFile();

    console.log(`Префикс изменен для канала ${channel} на ${newPrefix}`);
    return `Префикс успешно изменен на ${newPrefix}.`;
}

// Сохранение конфигурации в файл
function saveConfigToFile() {
    fs.writeFile(config.configPath, JSON.stringify(config, null, 4), (err) => {
        if (err) {
            console.error('Ошибка при сохранении файла конфигурации:', err);
        } else {
            console.log('Файл конфигурации сохранен.');
        }
    });
}

// Функция для обработки команды изменения префикса
function handlePrefixCommand(channel, userstate, args) {
    // Извлекаем аргументы из сообщения
    const newPrefix = args[0];

    // Проверяем, является ли отправитель модератором канала
    const senderIsMod = userstate['mod']; // Проверяем через userstate модератора

    // Вызываем функцию изменения префикса
    const result = changePrefix(channel, newPrefix, senderIsMod);

    // Отправляем результат в чат
    sendMessage(channel, result);
}

// Обработчик команды *ping
async function handlePingCommand(channel) {
    const startTime = Date.now();
    const uptime = process.uptime();
    const memoryUsage = formatMemoryUsage();

    let temperature = 'N/A';
    try {
        const cpuInfo = await si.cpuTemperature();
        if (cpuInfo.main !== undefined) {
            temperature = `${cpuInfo.main} °C`;
        }
    } catch (error) {
        console.error('Ошибка при получении температуры CPU:', error);
    }

    try {
        const ping = await client.ping();
        const endTime = Date.now();
        const totalPing = Math.round((endTime - startTime) / 1000);
        const pingMessage = `● jezelfSmile Понг! ● Задержка: ${ping} мс (TMI) ${totalPing} с (Internal) ● Время работы: ${formatUptime(uptime)} ● Использование памяти: ${memoryUsage} ● Каналы: ${config.channels.length}`;

        sendMessage(channel, pingMessage);
    } catch (err) {
        console.error('Ошибка при отправке сообщения пинга:', err);
    }
}

// Обработчик команды *uptime
function handleUptimeCommand(channel) {
    const uptime = process.uptime();
    sendMessage(channel, `● Время работы: ${formatUptime(uptime)}`);
}

// Обработчик команды *join
async function handleJoinCommand(channel, userstate, args) {
    if (args.length < 1) {
        sendMessage(channel, `/me ${userstate['display-name']}, пожалуйста, укажите название канала.`);
        return;
    }

    const targetChannel = args[0].toLowerCase();

    try {
        if (config.channels.includes(targetChannel)) {
            console.log(`Бот уже подключен к каналу ${targetChannel}`);
            return;
        }

        await client.join(targetChannel);
        console.log(`Подключен к каналу ${targetChannel}`);

        config.channels.push(targetChannel);
        saveChannels(config.channels);

        sendMessage(targetChannel, `/me jezelfLurk FeelsDankMan`);
        sendMessage(channel, `/me Успешно подключился к каналу ${targetChannel}`);
    } catch (err) {
        console.error(`Ошибка при подключении к каналу ${targetChannel}:`, err);
        sendMessage(channel, `/me Произошла ошибка при подключении к каналу ${targetChannel}`);
    }
}

// Обработчик команды *part
async function handlePartCommand(channel, userstate, args) {
    if (args.length < 1) {
        sendMessage(channel, `/me ${userstate['display-name']}, пожалуйста, укажите название канала.`);
        return;
    }

    const targetChannel = args[0].toLowerCase();

    try {
        if (!config.channels.includes(targetChannel)) {
            console.log(`Бот не подключен к каналу ${targetChannel}`);
            return;
        }

        await partChannels([targetChannel]);
        console.log(`Отключен от канала ${targetChannel}`);

        config.channels = config.channels.filter(chan => chan !== targetChannel);
        saveChannels(config.channels);

        sendMessage(channel, `/me Успешно отключился от канала ${targetChannel}`);
    } catch (err) {
        console.error(`Ошибка при отключении от канала ${targetChannel}:`, err);
        sendMessage(channel, `/me Произошла ошибка при отключении от канала ${targetChannel}`);
    }
}

// Обработчик события подключения к чату
client.on('connected', (address, port) => {
    console.log(`Подключен к ${address}:${port}`);

    config.channels = loadChannels();

    if (config.channels.length > 0) {
        console.log(`Присоединяюсь к каналам: ${config.channels.join(', ')}`);
        joinChannels(config.channels);
    } else {
        console.error('Список каналов пустой или не удалось загрузить.');
    }
});

// Обработчик сообщений
client.on('message', async (channel, userstate, message, self) => {
    if (self) return;

    // Получаем имя пользователя
    const username = userstate['username'] || userstate['display-name'];

    console.log(`[${channel}] ${username}: ${message}`);

    // Получаем префикс для текущего канала или используем префикс по умолчанию
    const currentPrefix = config.channelPrefixes[channel] || config.prefix;

    // Проверяем, начинается ли сообщение с текущего префикса
    if (!message.startsWith(currentPrefix)) return;

    // Убираем префикс из сообщения и разделяем его на аргументы
    const commandBody = message.slice(currentPrefix.length).trim();
    const args = commandBody.split(/\s+/);
    const command = args.shift().toLowerCase();

    // Проверка на отключение команд, если это не JEZELFY
    if (!commandsEnabled && username.toLowerCase() !== 'jezelfy') return;

    switch (command) {
        case 'prefix':
            handlePrefixCommand(channel, userstate, args);
            break;
        case 'ping':
            handlePingCommand(channel);
            break;
        case 'uptime':
            handleUptimeCommand(channel);
            break;
        case 'join':
            handleJoinCommand(channel, userstate, args);
            break;
        case 'part':
            handlePartCommand(channel, userstate, args);
            break;
        default:
            console.log(`Неизвестная команда: ${command}`);
    }
});

// Запуск клиента
client.connect().catch(console.error);
