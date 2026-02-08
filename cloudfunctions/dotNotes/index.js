// 云函数：dotNotes - 管理时间点的文字记录
const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 云函数入口函数
 * 支持的操作：get, save, delete, list
 */
exports.main = async (event, context) => {
    const { action, data } = event;
    const wxContext = cloud.getWXContext();

    try {
        switch (action) {
            case 'get':
                return await getDotNote(data, wxContext);
            case 'save':
                return await saveDotNote(data, wxContext);
            case 'delete':
                return await deleteDotNote(data, wxContext);
            case 'list':
                return await listDotNotes(data, wxContext);
            default:
                return {
                    success: false,
                    error: `未知操作: ${action}`
                };
        }
    } catch (err) {
        console.error('云函数执行错误:', err);
        return {
            success: false,
            error: err.message || '操作失败'
        };
    }
};

/**
 * 获取单个点的文字记录
 * @param {Object} data - { birthday, unit, dotIndex }
 * @param {Object} wxContext - 微信上下文
 */
async function getDotNote(data, wxContext) {
    const { birthday, unit, dotIndex } = data;
    const openid = wxContext.OPENID;

    const res = await db.collection('dot_notes')
        .where({
            _openid: openid,
            birthday: birthday,
            unit: unit,
            dotIndex: dotIndex
        })
        .get();

    if (res.data && res.data.length > 0) {
        return {
            success: true,
            data: res.data[0]
        };
    }

    return {
        success: true,
        data: null
    };
}

/**
 * 保存或更新文字记录
 * @param {Object} data - { birthday, unit, dotIndex, timestamp, note }
 * @param {Object} wxContext - 微信上下文
 */
async function saveDotNote(data, wxContext) {
    const { birthday, unit, dotIndex, timestamp, note } = data;
    const openid = wxContext.OPENID;

    // 检查是否已存在记录
    const existing = await db.collection('dot_notes')
        .where({
            _openid: openid,
            birthday: birthday,
            unit: unit,
            dotIndex: dotIndex
        })
        .get();

    const now = new Date();

    if (existing.data && existing.data.length > 0) {
        // 更新现有记录
        const noteId = existing.data[0]._id;

        if (note.trim() === '') {
            // 如果文字为空，删除记录
            await db.collection('dot_notes').doc(noteId).remove();
            return {
                success: true,
                deleted: true
            };
        }

        await db.collection('dot_notes').doc(noteId).update({
            data: {
                note: note,
                timestamp: timestamp,
                updatedAt: now
            }
        });

        return {
            success: true,
            noteId: noteId,
            updated: true
        };
    } else {
        // 新增记录
        if (note.trim() === '') {
            return {
                success: true,
                message: '空文字，无需保存'
            };
        }

        const res = await db.collection('dot_notes').add({
            data: {
                _openid: openid,
                birthday: birthday,
                unit: unit,
                dotIndex: dotIndex,
                timestamp: timestamp,
                note: note,
                createdAt: now,
                updatedAt: now
            }
        });

        return {
            success: true,
            noteId: res._id,
            created: true
        };
    }
}

/**
 * 删除文字记录
 * @param {Object} data - { noteId } 或 { birthday, unit, dotIndex }
 * @param {Object} wxContext - 微信上下文
 */
async function deleteDotNote(data, wxContext) {
    const openid = wxContext.OPENID;

    if (data.noteId) {
        // 通过 noteId 删除
        await db.collection('dot_notes').doc(data.noteId).remove();
    } else {
        // 通过条件删除
        const { birthday, unit, dotIndex } = data;
        await db.collection('dot_notes')
            .where({
                _openid: openid,
                birthday: birthday,
                unit: unit,
                dotIndex: dotIndex
            })
            .remove();
    }

    return {
        success: true,
        deleted: true
    };
}

/**
 * 获取当前视图下所有有文字的点
 * @param {Object} data - { birthday, unit }
 * @param {Object} wxContext - 微信上下文
 */
async function listDotNotes(data, wxContext) {
    const { birthday, unit } = data;
    const openid = wxContext.OPENID;

    const res = await db.collection('dot_notes')
        .where({
            _openid: openid,
            birthday: birthday,
            unit: unit
        })
        .field({
            dotIndex: true,
            note: true,
            timestamp: true,
            updatedAt: true
        })
        .get();

    return {
        success: true,
        data: res.data || []
    };
}
