/**
 * Simple in-memory database for development when MongoDB is not available
 */

// In-memory collections
const collections = {
    users: new Map(),
    gangs: new Map(),
    activityLogs: new Map()
};

// User methods
const userMethods = {
    findOne: async (query) => {
        if (query.discordId) {
            const user = collections.users.get(query.discordId);
            if (user) {
                // Create a deep copy of the user to avoid reference issues
                const userCopy = JSON.parse(JSON.stringify(user));

                // Restore methods that were lost in the deep copy
                userCopy.save = async function () {
                    // Update the updatedAt timestamp
                    this.updatedAt = new Date();

                    // Store the updated user back in the collection
                    collections.users.set(this.discordId, this);

                    // Return the updated user
                    return this;
                };

                userCopy.getCurrentGangPoints = function () {
                    const currentGangPoints = this.gangPoints.find(g => g.gangId === this.currentGangId);
                    return currentGangPoints ? currentGangPoints.points : 0;
                };

                userCopy.getCurrentGangWeeklyPoints = function () {
                    const currentGangPoints = this.gangPoints.find(g => g.gangId === this.currentGangId);
                    return currentGangPoints ? currentGangPoints.weeklyPoints : 0;
                };

                userCopy.addPointsToGang = function (gangId, gangName, points, source) {
                    let gangPoints = this.gangPoints.find(g => g.gangId === gangId);

                    // Create a new gang entry if it doesn't exist
                    if (!gangPoints) {
                        gangPoints = {
                            gangId,
                            gangName,
                            points: 0,
                            weeklyPoints: 0,
                            pointsBreakdown: {
                                games: 0,
                                artAndMemes: 0,
                                activity: 0,
                                gangActivity: 0,
                                other: 0
                            },
                            weeklyPointsBreakdown: {
                                games: 0,
                                artAndMemes: 0,
                                activity: 0,
                                gangActivity: 0,
                                other: 0
                            }
                        };
                        this.gangPoints.push(gangPoints);
                    }

                    // Add the points to this specific gang
                    gangPoints.points += points;
                    gangPoints.weeklyPoints += points;

                    // Update the proper category
                    if (source === 'games') {
                        gangPoints.pointsBreakdown.games += points;
                        gangPoints.weeklyPointsBreakdown.games += points;
                    } else if (source === 'artAndMemes') {
                        gangPoints.pointsBreakdown.artAndMemes += points;
                        gangPoints.weeklyPointsBreakdown.artAndMemes += points;
                    } else if (source === 'activity') {
                        gangPoints.pointsBreakdown.activity += points;
                        gangPoints.weeklyPointsBreakdown.activity += points;
                    } else if (source === 'gangActivity') {
                        gangPoints.pointsBreakdown.gangActivity += points;
                        gangPoints.weeklyPointsBreakdown.gangActivity += points;
                    } else {
                        gangPoints.pointsBreakdown.other += points;
                        gangPoints.weeklyPointsBreakdown.other += points;
                    }

                    // If this is the user's current gang, update their total points
                    if (gangId === this.currentGangId) {
                        console.log(`Adding ${points} points to user (from source: ${source})`);
                        console.log(`Before update: User has ${this.points} total points`);

                        // Calculate total points by summing points from all gangs
                        let totalPoints = 0;
                        let totalWeeklyPoints = 0;

                        for (const g of this.gangPoints) {
                            totalPoints += g.points;
                            totalWeeklyPoints += g.weeklyPoints;
                        }

                        // Update the user's total points
                        this.points = totalPoints;
                        this.weeklyPoints = totalWeeklyPoints;

                        console.log(`After update: User now has ${this.points} total points`);

                        // Update backward compatibility fields
                        this.gangId = gangId;
                        this.gangName = gangName;
                    }

                    // Make sure changes are persisted back to the collection
                    collections.users.set(this.discordId, this);

                    return gangPoints;
                };

                userCopy.switchGang = function (newGangId, newGangName) {
                    if (this.currentGangId === newGangId) return;

                    this.currentGangId = newGangId;
                    this.currentGangName = newGangName;
                    this.gangId = newGangId;
                    this.gangName = newGangName;

                    const newGangPoints = this.gangPoints.find(g => g.gangId === newGangId);

                    if (!newGangPoints) {
                        // Create new gang entry if it doesn't exist
                        this.gangPoints.push({
                            gangId: newGangId,
                            gangName: newGangName,
                            points: 0,
                            weeklyPoints: 0,
                            pointsBreakdown: {
                                games: 0,
                                artAndMemes: 0,
                                activity: 0,
                                gangActivity: 0,
                                other: 0
                            },
                            weeklyPointsBreakdown: {
                                games: 0,
                                artAndMemes: 0,
                                activity: 0,
                                gangActivity: 0,
                                other: 0
                            }
                        });
                    }

                    // Calculate total points from all gangs
                    let totalPoints = 0;
                    let totalWeeklyPoints = 0;

                    // Sum points from all gangs the user belongs to
                    for (const g of this.gangPoints) {
                        totalPoints += g.points;
                        totalWeeklyPoints += g.weeklyPoints;
                    }

                    // Update the user's total points
                    this.points = totalPoints;
                    this.weeklyPoints = totalWeeklyPoints;

                    // Make sure changes are persisted
                    collections.users.set(this.discordId, this);
                };

                return userCopy;
            }
        }
        return null;
    },

    findById: async (id) => {
        return collections.users.get(id);
    },

    find: async (query = {}) => {
        let users = Array.from(collections.users.values());

        // Filtrar por currentGangId se especificado
        if (query.currentGangId) {
            users = users.filter(user => user.currentGangId === query.currentGangId);
        }

        // Filtrar por points maior que valor específico
        if (query.points && query.points.$gt !== undefined) {
            users = users.filter(user => user.points > query.points.$gt);
        }

        // Wrapper object with chainable methods
        const result = {
            data: users,
            sort: function (sortOptions) {
                const field = Object.keys(sortOptions)[0];
                const direction = sortOptions[field];

                this.data = [...this.data].sort((a, b) => {
                    if (direction === 1) {
                        return a[field] - b[field];
                    } else {
                        return b[field] - a[field];
                    }
                });

                return this;
            },
            skip: function (n) {
                this.data = this.data.slice(n);
                return this;
            },
            limit: function (n) {
                this.data = this.data.slice(0, n);
                return this;
            },
            // Allow iterating over the result
            [Symbol.iterator]: function* () {
                yield* this.data;
            },
            // Length getter for compatibility
            get length() {
                return this.data.length;
            },
            // Array index access
            forEach: function (callback) {
                this.data.forEach(callback);
                return this;
            },
            map: function (callback) {
                return this.data.map(callback);
            },
            some: function (callback) {
                return this.data.some(callback);
            }
        };

        return result;
    },

    countDocuments: async (query = {}) => {
        // Se não houver query, retorna o tamanho total
        if (Object.keys(query).length === 0) {
            return collections.users.size;
        }

        // Caso contrário, temos que filtrar
        let count = 0;

        // Verificar se estamos contando por currentGangId e points
        if (query.currentGangId && query.points && query.points.$gt !== undefined) {
            for (const user of collections.users.values()) {
                if (user.currentGangId === query.currentGangId && user.points > query.points.$gt) {
                    count++;
                }
            }
        }
        // Apenas currentGangId
        else if (query.currentGangId) {
            for (const user of collections.users.values()) {
                if (user.currentGangId === query.currentGangId) {
                    count++;
                }
            }
        }
        // Apenas points
        else if (query.points && query.points.$gt !== undefined) {
            for (const user of collections.users.values()) {
                if (user.points > query.points.$gt) {
                    count++;
                }
            }
        }

        return count;
    },

    create: async (userData) => {
        const user = {
            ...userData,
            _id: userData.discordId,
            createdAt: new Date(),
            updatedAt: new Date(),
            gangPoints: userData.gangPoints || [],
            recentMessages: userData.recentMessages || [],
            save: async function () {
                // Update the updatedAt timestamp
                this.updatedAt = new Date();

                // Store the updated user back in the collection
                collections.users.set(this.discordId, this);

                // Return the updated user
                return this;
            }
        };

        // Add helper methods
        user.getCurrentGangPoints = () => {
            const currentGangPoints = user.gangPoints.find(g => g.gangId === user.currentGangId);
            return currentGangPoints ? currentGangPoints.points : 0;
        };

        user.getCurrentGangWeeklyPoints = () => {
            const currentGangPoints = user.gangPoints.find(g => g.gangId === user.currentGangId);
            return currentGangPoints ? currentGangPoints.weeklyPoints : 0;
        };

        user.addPointsToGang = function (gangId, gangName, points, source) {
            let gangPoints = this.gangPoints.find(g => g.gangId === gangId);

            if (!gangPoints) {
                gangPoints = {
                    gangId,
                    gangName,
                    points: 0,
                    weeklyPoints: 0,
                    pointsBreakdown: {
                        games: 0,
                        artAndMemes: 0,
                        activity: 0,
                        gangActivity: 0,
                        other: 0
                    },
                    weeklyPointsBreakdown: {
                        games: 0,
                        artAndMemes: 0,
                        activity: 0,
                        gangActivity: 0,
                        other: 0
                    }
                };
                this.gangPoints.push(gangPoints);
            }

            gangPoints.points += points;
            gangPoints.weeklyPoints += points;

            if (source === 'games') {
                gangPoints.pointsBreakdown.games += points;
                gangPoints.weeklyPointsBreakdown.games += points;
            } else if (source === 'artAndMemes') {
                gangPoints.pointsBreakdown.artAndMemes += points;
                gangPoints.weeklyPointsBreakdown.artAndMemes += points;
            } else if (source === 'activity') {
                gangPoints.pointsBreakdown.activity += points;
                gangPoints.weeklyPointsBreakdown.activity += points;
            } else if (source === 'gangActivity') {
                gangPoints.pointsBreakdown.gangActivity += points;
                gangPoints.weeklyPointsBreakdown.gangActivity += points;
            } else {
                gangPoints.pointsBreakdown.other += points;
                gangPoints.weeklyPointsBreakdown.other += points;
            }

            // If this is the user's current gang, update their master points total
            if (gangId === this.currentGangId) {
                // Calculate total points from all gangs
                let totalPoints = 0;
                let totalWeeklyPoints = 0;

                // Sum points from all gangs the user belongs to
                for (const g of this.gangPoints) {
                    totalPoints += g.points;
                    totalWeeklyPoints += g.weeklyPoints;
                }

                // Update the user's total points
                this.points = totalPoints;
                this.weeklyPoints = totalWeeklyPoints;

                // Ensure backward compatibility
                this.gangId = gangId;
                this.gangName = gangName;
            }

            // Make sure changes are persisted
            collections.users.set(this.discordId, this);

            return gangPoints;
        };

        user.switchGang = function (newGangId, newGangName) {
            if (this.currentGangId === newGangId) return;

            this.currentGangId = newGangId;
            this.currentGangName = newGangName;
            this.gangId = newGangId;
            this.gangName = newGangName;

            const newGangPoints = this.gangPoints.find(g => g.gangId === newGangId);

            if (!newGangPoints) {
                // Create new gang entry if it doesn't exist
                this.gangPoints.push({
                    gangId: newGangId,
                    gangName: newGangName,
                    points: 0,
                    weeklyPoints: 0,
                    pointsBreakdown: {
                        games: 0,
                        artAndMemes: 0,
                        activity: 0,
                        gangActivity: 0,
                        other: 0
                    },
                    weeklyPointsBreakdown: {
                        games: 0,
                        artAndMemes: 0,
                        activity: 0,
                        gangActivity: 0,
                        other: 0
                    }
                });
            }

            // Calculate total points from all gangs
            let totalPoints = 0;
            let totalWeeklyPoints = 0;

            // Sum points from all gangs the user belongs to
            for (const g of this.gangPoints) {
                totalPoints += g.points;
                totalWeeklyPoints += g.weeklyPoints;
            }

            // Update the user's total points
            this.points = totalPoints;
            this.weeklyPoints = totalWeeklyPoints;

            // Make sure changes are persisted
            collections.users.set(this.discordId, this);
        };

        collections.users.set(userData.discordId, user);
        return user;
    },

    aggregate: async (pipeline) => {
        // Implementação muito simples apenas para o caso específico usado no código
        // $match e $group simples

        if (pipeline.length < 2) return [];

        const match = pipeline[0].$match || {};
        const group = pipeline[1].$group || {};

        // Filtrando usuários
        let users = Array.from(collections.users.values());

        if (match.currentGangId) {
            users = users.filter(user => user.currentGangId === match.currentGangId);
        }

        // Agrupamento simples para soma de pontos
        if (group._id === null) {
            let result = { _id: null };

            if (group.totalPoints) {
                result.totalPoints = users.reduce((sum, user) => sum + user.points, 0);
            }

            if (group.totalWeeklyPoints) {
                result.totalWeeklyPoints = users.reduce((sum, user) => sum + user.weeklyPoints, 0);
            }

            if (group.count) {
                result.count = users.length;
            }

            return [result];
        }

        return [];
    },

    deleteMany: async () => {
        collections.users.clear();
        return { deletedCount: 0 };
    }
};

// Gang methods
const gangMethods = {
    findOne: async (query) => {
        if (query.gangId) {
            return collections.gangs.get(query.gangId);
        }
        return null;
    },

    findById: async (id) => {
        return collections.gangs.get(id);
    },

    find: async (query = {}) => {
        let gangs = Array.from(collections.gangs.values());

        // Filtrar por guildId se especificado
        if (query.guildId) {
            gangs = gangs.filter(gang => gang.guildId === query.guildId);
        }

        // Wrapper object with chainable methods
        const result = {
            data: gangs,
            sort: function (sortOptions) {
                const field = Object.keys(sortOptions)[0];
                const direction = sortOptions[field];

                this.data = [...this.data].sort((a, b) => {
                    if (direction === 1) {
                        return a[field] - b[field];
                    } else {
                        return b[field] - a[field];
                    }
                });

                return this;
            },
            skip: function (n) {
                this.data = this.data.slice(n);
                return this;
            },
            limit: function (n) {
                this.data = this.data.slice(0, n);
                return this;
            },
            // Allow iterating over the result
            [Symbol.iterator]: function* () {
                yield* this.data;
            },
            // Length getter for compatibility
            get length() {
                return this.data.length;
            },
            // Array index access
            forEach: function (callback) {
                this.data.forEach(callback);
                return this;
            },
            map: function (callback) {
                return this.data.map(callback);
            },
            some: function (callback) {
                return this.data.some(callback);
            }
        };

        return result;
    },

    create: async (gangData) => {
        const gang = {
            ...gangData,
            _id: gangData.gangId,
            createdAt: new Date(),
            updatedAt: new Date(),
            save: async () => gang
        };

        // Add virtual properties
        Object.defineProperty(gang, 'totalScore', {
            get: function () {
                return this.points + (this.totalMemberPoints || 0);
            }
        });

        Object.defineProperty(gang, 'weeklyTotalScore', {
            get: function () {
                return this.weeklyPoints + (this.weeklyMemberPoints || 0);
            }
        });

        collections.gangs.set(gangData.gangId, gang);
        return gang;
    },

    findOneAndUpdate: async (query, update, options = {}) => {
        const gangId = query.gangId;
        let gang = collections.gangs.get(gangId);

        if (!gang && options.upsert) {
            // Criar gang se não existir e upsert=true
            gang = {
                gangId,
                points: 0,
                weeklyPoints: 0,
                totalMemberPoints: 0,
                weeklyMemberPoints: 0,
                messageCount: 0,
                weeklyMessageCount: 0,
                pointsBreakdown: {
                    events: 0,
                    competitions: 0,
                    other: 0
                },
                weeklyPointsBreakdown: {
                    events: 0,
                    competitions: 0,
                    other: 0
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                save: async () => gang
            };

            Object.defineProperty(gang, 'totalScore', {
                get: function () {
                    return this.points + (this.totalMemberPoints || 0);
                }
            });

            Object.defineProperty(gang, 'weeklyTotalScore', {
                get: function () {
                    return this.weeklyPoints + (this.weeklyMemberPoints || 0);
                }
            });

            collections.gangs.set(gangId, gang);
        }

        if (!gang) {
            return { value: null };
        }

        // Aplicar atualizações $set
        if (update.$set) {
            Object.assign(gang, update.$set);
        }

        // Aplicar atualizações $inc
        if (update.$inc) {
            for (const [key, value] of Object.entries(update.$inc)) {
                if (key.includes('.')) {
                    // Para chaves aninhadas como pointsBreakdown.events
                    const [obj, prop] = key.split('.');
                    if (gang[obj]) {
                        gang[obj][prop] = (gang[obj][prop] || 0) + value;
                    }
                } else {
                    gang[key] = (gang[key] || 0) + value;
                }
            }
        }

        gang.updatedAt = new Date();

        return { value: gang };
    },

    updateOne: async (query, update) => {
        let gang = null;

        // Encontrar a gang com base na query
        if (query.gangId) {
            gang = collections.gangs.get(query.gangId);
        }

        if (!gang) {
            return { modifiedCount: 0 };
        }

        // Aplicar atualizações $set
        if (update.$set) {
            Object.assign(gang, update.$set);
        }

        // Aplicar atualizações $inc
        if (update.$inc) {
            for (const [key, value] of Object.entries(update.$inc)) {
                if (key.includes('.')) {
                    // Para chaves aninhadas como pointsBreakdown.events
                    const [obj, prop] = key.split('.');
                    if (gang[obj]) {
                        gang[obj][prop] = (gang[obj][prop] || 0) + value;
                    }
                } else {
                    gang[key] = (gang[key] || 0) + value;
                }
            }
        }

        gang.updatedAt = new Date();

        return { modifiedCount: 1 };
    },

    updateMany: async (query, update) => {
        let gangs = Array.from(collections.gangs.values());
        let modifiedCount = 0;

        // Filtrar gangs com base na query
        if (query.guildId) {
            gangs = gangs.filter(gang => gang.guildId === query.guildId);
        }

        // Aplicar atualizações em cada gang
        for (const gang of gangs) {
            // Aplicar atualizações $set
            if (update.$set) {
                Object.assign(gang, update.$set);
                modifiedCount++;
            }
        }

        return { modifiedCount };
    },

    deleteMany: async (query) => {
        let deletedCount = 0;

        if (query.gangId && query.gangId.$nin) {
            const validGangIds = query.gangId.$nin;

            for (const [gangId, gang] of collections.gangs.entries()) {
                if (!validGangIds.includes(gangId)) {
                    collections.gangs.delete(gangId);
                    deletedCount++;
                }
            }
        } else {
            deletedCount = collections.gangs.size;
            collections.gangs.clear();
        }

        return { deletedCount };
    }
};

// Activity log methods
const activityLogMethods = {
    create: async (logData) => {
        const log = {
            ...logData,
            _id: Date.now().toString(),
            createdAt: new Date(),
            updatedAt: new Date(),
            save: async () => log
        };

        collections.activityLogs.set(log._id, log);
        return log;
    },

    find: async (query = {}) => {
        const logs = Array.from(collections.activityLogs.values());

        // Filtrar por data se especificado
        if (query.createdAt && query.createdAt.$gte) {
            logs = logs.filter(log => log.createdAt >= query.createdAt.$gte);
        }
        if (query.createdAt && query.createdAt.$lte) {
            logs = logs.filter(log => log.createdAt <= query.createdAt.$lte);
        }

        return logs;
    },

    deleteMany: async () => {
        collections.activityLogs.clear();
        return { deletedCount: collections.activityLogs.size };
    }
};

// Create constructors that return objects from the methods
function User(data) {
    const user = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        gangPoints: data.gangPoints || [],
        recentMessages: data.recentMessages || [],
        save: async function () {
            collections.users.set(this.discordId, this);
            return this;
        }
    };

    // Add methods
    user.getCurrentGangPoints = function () {
        const currentGangPoints = this.gangPoints.find(g => g.gangId === this.currentGangId);
        return currentGangPoints ? currentGangPoints.points : 0;
    };

    user.getCurrentGangWeeklyPoints = function () {
        const currentGangPoints = this.gangPoints.find(g => g.gangId === this.currentGangId);
        return currentGangPoints ? currentGangPoints.weeklyPoints : 0;
    };

    user.addPointsToGang = function (gangId, gangName, points, source) {
        let gangPoints = this.gangPoints.find(g => g.gangId === gangId);

        if (!gangPoints) {
            gangPoints = {
                gangId,
                gangName,
                points: 0,
                weeklyPoints: 0,
                pointsBreakdown: {
                    games: 0,
                    artAndMemes: 0,
                    activity: 0,
                    gangActivity: 0,
                    other: 0
                },
                weeklyPointsBreakdown: {
                    games: 0,
                    artAndMemes: 0,
                    activity: 0,
                    gangActivity: 0,
                    other: 0
                }
            };
            this.gangPoints.push(gangPoints);
        }

        gangPoints.points += points;
        gangPoints.weeklyPoints += points;

        if (source === 'games') {
            gangPoints.pointsBreakdown.games += points;
            gangPoints.weeklyPointsBreakdown.games += points;
        } else if (source === 'artAndMemes') {
            gangPoints.pointsBreakdown.artAndMemes += points;
            gangPoints.weeklyPointsBreakdown.artAndMemes += points;
        } else if (source === 'activity') {
            gangPoints.pointsBreakdown.activity += points;
            gangPoints.weeklyPointsBreakdown.activity += points;
        } else if (source === 'gangActivity') {
            gangPoints.pointsBreakdown.gangActivity += points;
            gangPoints.weeklyPointsBreakdown.gangActivity += points;
        } else {
            gangPoints.pointsBreakdown.other += points;
            gangPoints.weeklyPointsBreakdown.other += points;
        }

        // If this is the user's current gang, update their master points total
        if (gangId === this.currentGangId) {
            // Calculate total points from all gangs
            let totalPoints = 0;
            let totalWeeklyPoints = 0;

            // Sum points from all gangs the user belongs to
            for (const g of this.gangPoints) {
                totalPoints += g.points;
                totalWeeklyPoints += g.weeklyPoints;
            }

            // Update the user's total points
            this.points = totalPoints;
            this.weeklyPoints = totalWeeklyPoints;

            // Ensure backward compatibility
            this.gangId = gangId;
            this.gangName = gangName;
        }

        // Make sure changes are persisted
        collections.users.set(this.discordId, this);

        return gangPoints;
    };

    user.switchGang = function (newGangId, newGangName) {
        if (this.currentGangId === newGangId) return;

        this.currentGangId = newGangId;
        this.currentGangName = newGangName;
        this.gangId = newGangId;
        this.gangName = newGangName;

        const newGangPoints = this.gangPoints.find(g => g.gangId === newGangId);

        if (!newGangPoints) {
            // Create new gang entry if it doesn't exist
            this.gangPoints.push({
                gangId: newGangId,
                gangName: newGangName,
                points: 0,
                weeklyPoints: 0,
                pointsBreakdown: {
                    games: 0,
                    artAndMemes: 0,
                    activity: 0,
                    gangActivity: 0,
                    other: 0
                },
                weeklyPointsBreakdown: {
                    games: 0,
                    artAndMemes: 0,
                    activity: 0,
                    gangActivity: 0,
                    other: 0
                }
            });
        }

        // Calculate total points from all gangs
        let totalPoints = 0;
        let totalWeeklyPoints = 0;

        // Sum points from all gangs the user belongs to
        for (const g of this.gangPoints) {
            totalPoints += g.points;
            totalWeeklyPoints += g.weeklyPoints;
        }

        // Update the user's total points
        this.points = totalPoints;
        this.weeklyPoints = totalWeeklyPoints;

        // Make sure changes are persisted
        collections.users.set(this.discordId, this);
    };

    return user;
}

function Gang(data) {
    const gang = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: async function () {
            collections.gangs.set(this.gangId, this);
            return this;
        }
    };

    // Add virtual properties
    Object.defineProperty(gang, 'totalScore', {
        get: function () {
            return this.points + (this.totalMemberPoints || 0);
        }
    });

    Object.defineProperty(gang, 'weeklyTotalScore', {
        get: function () {
            return this.weeklyPoints + (this.weeklyMemberPoints || 0);
        }
    });

    return gang;
}

function ActivityLog(data) {
    const log = {
        ...data,
        _id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
        save: async function () {
            collections.activityLogs.set(this._id, this);
            return this;
        }
    };

    return log;
}

// Adicionar métodos estáticos aos construtores
User.findOne = userMethods.findOne;
User.findById = userMethods.findById;
User.find = userMethods.find;
User.countDocuments = userMethods.countDocuments;
User.create = userMethods.create;
User.aggregate = userMethods.aggregate;
User.deleteMany = userMethods.deleteMany;

Gang.findOne = gangMethods.findOne;
Gang.findById = gangMethods.findById;
Gang.find = gangMethods.find;
Gang.create = gangMethods.create;
Gang.findOneAndUpdate = gangMethods.findOneAndUpdate;
Gang.updateOne = gangMethods.updateOne;
Gang.updateMany = gangMethods.updateMany;
Gang.deleteMany = gangMethods.deleteMany;

ActivityLog.create = activityLogMethods.create;
ActivityLog.find = activityLogMethods.find;
ActivityLog.deleteMany = activityLogMethods.deleteMany;

module.exports = {
    User,
    Gang,
    ActivityLog,
    isConnected: true
}; 