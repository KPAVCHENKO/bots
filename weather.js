const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Путь к файлу с данными о локациях
const locationsFilePath = path.join(__dirname, 'userLocations.json');

// Функция для загрузки локаций из файла
function loadUserLocations() {
    try {
        const data = fs.readFileSync(locationsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Ошибка при загрузке данных о локациях:', error);
        return {};
    }
}

// Функция для сохранения локаций в файл
function saveUserLocations(locations) {
    try {
        fs.writeFileSync(locationsFilePath, JSON.stringify(locations, null, 2), 'utf8');
        console.log('Локации успешно сохранены.');
    } catch (error) {
        console.error('Ошибка при сохранении данных о локациях:', error);
    }
}

// Функция для обработки команды *погода
async function handleWeatherCommand(channel, userstate, args, isTempCommand) {
    const user = userstate['display-name'] || userstate['username'];
    const locations = loadUserLocations();

    // Проверяем, указан ли никнейм или город
    let targetUser = user;
    let city = null;

    if (args.length > 0) {
        const firstArg = args[0];
        if (firstArg in locations) {
            // Если первый аргумент это никнейм из файла
            targetUser = firstArg;
            city = locations[targetUser]?.city;
        } else {
            // Если первый аргумент это город
            city = args.join(' ');
        }
    } else {
        // Если аргументы не указаны, используем местоположение текущего пользователя
        city = locations[user]?.city;
    }

    if (!city) {
        sendMessage(channel, `/me ${user}, местоположение не задано. Установите его командой set location.`);
        return;
    }

    const weatherUrl = `https://weatherapi-com.p.rapidapi.com/current.json?q=${encodeURIComponent(city)}`;
    const options = {
        method: 'GET',
        url: weatherUrl,
        headers: {
            'X-RapidAPI-Host': 'weatherapi-com.p.rapidapi.com',
            'X-RapidAPI-Key': 'e82bdc0226msh03d7c3e13235cabp1565b9jsn1dbe20d51ec3'
        }
    };

    try {
        const response = await axios.request(options);
        const weatherData = response.data;

        if (weatherData && weatherData.current) {
            const weather = weatherData.current;
            const temperature = weather.temp_c || 'Неизвестно';
            const feelsLike = weather.feelslike_c || 'Неизвестно';

            if (isTempCommand) {
                // Для команды temp выводим только температуру и ощущаемую температуру
                const tempMessage = `/me ${user}, сейчас Температура ${temperature}°C, ощущается как ${feelsLike}°C.`;
                sendMessage(channel, tempMessage);
            } else {
                // Для команды погода выводим полный отчет о погоде
                const cloudCover = weather.cloud || 'Неизвестно';
                const windSpeed = weather.wind_kph || 'Неизвестно';
                const humidity = weather.humidity || 'Неизвестно';
                const pressure = weather.pressure_mb ? weather.pressure_mb / 10 : 'Неизвестно'; // преобразуем мб в гПа
                const visibility = weather.vis_km || 'Неизвестно';
                const condition = weather.condition.text || 'Неизвестно';
                const lastUpdated = weather.last_updated || 'Неизвестно';
                const forecast = weatherData.forecast?.forecastday?.[0]?.astro || {};
                const sunrise = forecast.sunrise || 'Неизвестно';
                const sunset = forecast.sunset || 'Неизвестно';
                const precip = weather.precip_mm || 'Нет данных';

                // Перевод условий погоды на русский
                const conditionTranslation = {
                    'Clear': 'Ясно',
                    'Sunny': 'Солнечно',
                    'Partly cloudy': 'Частично облачно',
                    'Cloudy': 'Облачно',
                    'Overcast': 'Переменная облачность',
                    'Rain': 'Дождь',
                    'Drizzle': 'Морось',
                    'Showers': 'Ливень',
                    'Snow': 'Снег',
                    'Fog': 'Туман',
                    'Wind': 'Ветер',
                    'Thunderstorm': 'Гроза',
                    'Hail': 'Град'
                };

                const conditionInRussian = conditionTranslation[condition] || condition;

                // Эмодзи для различных условий
                const weatherEmoji = {
                    'Clear': '☀️',
                    'Partly cloudy': '⛅',
                    'Cloudy': '☁️',
                    'Overcast': '☁️',
                    'Rain': '🌧️',
                    'Drizzle': '🌦️',
                    'Showers': '🌦️',
                    'Snow': '❄️',
                    'Fog': '🌫️',
                    'Wind': '🌬️',
                    'Thunderstorm': '⛈️',
                    'Hail': '🌨️'
                };

                const conditionEmoji = weatherEmoji[condition] || '';

                const weatherMessage = `/me ${user}, сейчас Температура ${temperature}°C, ощущается как ${feelsLike}°C. Облачность: ${cloudCover}%. Ветер: ${windSpeed} км/ч. Влажность: ${humidity}%. Давление: ${pressure} гПа. Видимость: ${visibility} км. Оповещения о погоде: ${conditionEmoji} ${conditionInRussian}.`;

                sendMessage(channel, weatherMessage);
            }
        } else {
            sendMessage(channel, `/me ${user}, не удалось получить данные о погоде.`);
        }
    } catch (error) {
        console.error('Ошибка при получении данных о погоде:', error);
        sendMessage(channel, `/me ${user}, произошла ошибка при получении данных о погоде.`);
    }
}

// Функция для обработки команды *set location
async function handleSetLocationCommand(channel, userstate, args) {
    const user = userstate['display-name'] || userstate['username'];
    const city = args.join(' ');

    if (!city) {
        sendMessage(channel, `/me ${user}, укажите город для установки.`);
        return;
    }

    const locations = loadUserLocations();
    locations[user] = { city };
    saveUserLocations(locations);

    sendMessage(channel, `/me ${user}, ваше местоположение успешно обновлено.`);
}
