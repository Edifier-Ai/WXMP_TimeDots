/**
 * 时间计算工具函数
 */

/**
 * 计算已过天数和剩余天数
 * @param {string} birthday - 生日字符串 YYYY-MM-DD
 * @param {number} totalDays - 一生总天数，默认30000天
 * @returns {Object} { passedDays, remainingDays, passedPercent }
 */
function calculateLifeDays(birthday, totalDays = 30000) {
    const birthDate = new Date(birthday);
    const today = new Date();

    // 计算已过天数
    const diffTime = today.getTime() - birthDate.getTime();
    const passedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 计算剩余天数
    const remainingDays = Math.max(0, totalDays - passedDays);

    // 计算百分比
    const passedPercent = Math.min(100, (passedDays / totalDays) * 100);

    return {
        passedDays: Math.max(0, passedDays),
        remainingDays,
        passedPercent: passedPercent.toFixed(2)
    };
}

/**
 * 根据时间单位获取时间数据
 * @param {string} birthday - 生日字符串 YYYY-MM-DD
 * @param {string} unit - 时间单位: second, minute, hour, day, month, year
 * @returns {Object} { total, passed, remaining }
 */
function getTimeUnits(birthday, unit = 'day') {
    const { passedDays, remainingDays } = calculateLifeDays(birthday);
    const totalDays = 30000;

    const unitMultipliers = {
        second: 86400,  // 一天的秒数
        minute: 1440,   // 一天的分钟数
        hour: 24,       // 一天的小时数
        day: 1,
        month: 1 / 30,  // 约30天一个月
        year: 1 / 365   // 约365天一年
    };

    const multiplier = unitMultipliers[unit] || 1;

    return {
        total: Math.floor(totalDays * multiplier),
        passed: Math.floor(passedDays * multiplier),
        remaining: Math.floor(remainingDays * multiplier),
        unit
    };
}

/**
 * 格式化时间显示
 * @param {number} value - 数值
 * @param {string} unit - 时间单位
 * @returns {string} 格式化后的字符串
 */
function formatTimeDisplay(value, unit) {
    const unitNames = {
        second: '秒',
        minute: '分钟',
        hour: '小时',
        day: '天',
        month: '月',
        year: '年'
    };

    return `${value.toLocaleString()} ${unitNames[unit] || unit}`;
}

/**
 * 获取今天的日期字符串
 * @returns {string} YYYY-MM-DD
 */
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

module.exports = {
    calculateLifeDays,
    getTimeUnits,
    formatTimeDisplay,
    getTodayString
};
