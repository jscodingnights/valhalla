'use strict';

let express = require('express');
let app = express();
let cors = require('cors');
let http = require('http').Server(app);
let io = require('socket.io')(http);
let bodyParser = require('body-parser');

app.use(cors());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

let port = 8080;

var mapSizeX = 30;
var mapSizeY = 30;


let Viking = require('./Viking.js');
let vikingsList = [];

let findVikingById = function (id) {

    let viking = null;

    vikingsList.forEach(function (v) {

        if (v.id === id) {
            viking = v;
        }

    });

    return viking;

};

let findVikingByPosition = function (position) {

    let viking = null;

    vikingsList.forEach(function (v) {

        if (v.position.x === position.x && v.position.y === position.y) {
            viking = v;
        }

    });

    return viking;

};

let findVikingsByOrder = function (order) {

    let vikings = [];

    vikingsList.forEach(function (v) {

        if (v.action.order === order) {
            vikings.push(v);
        }

    });

    return vikings;

};

let parseVikings = function () {

    let parsedVikings = [];

    vikingsList.forEach(function (v) {

        parsedVikings.push(v.parse());

    });

    return parsedVikings;
};

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

let router = express.Router();

router.get('/', function (req, res) {
    res.json({message: 'It works!'});
});

router.route('/vikings')

    .post(function (req, res) {

        let viking = new Viking();

        let maxTries = 10;
        let position = {x: getRandomInt(0,mapSizeX), y: getRandomInt(0,mapSizeY)};

        while(findVikingByPosition(position) && maxTries--) {
            position = {x: getRandomInt(0,mapSizeX), y: getRandomInt(0,mapSizeY)};
        }

        if (maxTries === 0 ) {
            res.json({error: 'could not find empty spot for you viking, please try again'});
            return;
        }

        viking.position = position;

        viking.name = req.body.name;

        vikingsList.push(viking);

        let sendWithId = true;
        res.json(viking.parse(sendWithId));

        io.sockets.emit('vikingsUpdate', {vikings: parseVikings()});
    })

    .put(function (req, res) {

        let viking = findVikingById(req.body.id);

        if(!viking){
            res.status(400).json({error:'deadViking'});
            return;
        }

        viking.action = req.body.action;

        res.json(viking.parse());
    })

    .get(function (req, res) {

        console.log('getting vikings');

        res.json({vikings: parseVikings()});
    });


app.use('/api', router);
app.use(function(err, req, res, next) {
    console.log(err);
    // you suck
});

let handleVikingAttack = function (viking) {

    try {

        let attackPosition = viking.getActionPosition();

        let otherViking = findVikingByPosition(attackPosition);

        if (otherViking) {

            otherViking.health -= viking.level;

            if (otherViking.isDead()) {
                viking.kills += 1;
            }

        }

    } catch (e) {
        console.log(e);
    }

};

let handleVikingMove = function (viking) {

    try {

        let movePosition = viking.getActionPosition();

        let otherViking = findVikingByPosition(movePosition);

        if (otherViking) {

            throw new Error(viking.id + ' something is in my way');
        }

        viking.position = movePosition;

    } catch (e) {
        console.log(e);
    }

};

let handleVikingHeal = function (viking) {

    try {

        viking.increaseHitPoints( viking.level );

    } catch (e) {
        console.log(e);
    }

};

let disposeBodies = function() {

    let i = vikingsList.length;

    while (i--) {

        let viking = vikingsList[i];

        if (viking.isDead()) {
            vikingsList.splice(i, 1);
        }
    }
};

let resetVikingsOrders = function() {

    vikingsList.forEach(function (viking) {

        viking.action.order = 'stop';

    });

};

let levelUpVikings = function() {

    vikingsList.forEach(function (viking) {

        viking.checkForLevelUp();

    });

};

let gameRound = 1;

let gameUpdate = function () {

    console.log('Game round '+ (gameRound++));

    let vikings = findVikingsByOrder('attack');

    vikings.forEach(function (viking) {

        handleVikingAttack(viking);

    });

    disposeBodies();

    levelUpVikings();

    vikings = findVikingsByOrder('move');

    vikings.forEach(function (viking) {

        handleVikingMove(viking);

    });

    vikings = findVikingsByOrder('heal');

    vikings.forEach(function (viking) {

        handleVikingHeal(viking);

    });

    resetVikingsOrders();

    io.sockets.emit('vikingsUpdate', {vikings: parseVikings()});

};

let gameInterval = setInterval(gameUpdate, 10000);

io.on('connection', function(){
    console.log('a user connected');
});

http.listen(port, function(){
    console.log('listening on '+ port);
});

