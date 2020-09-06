var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var port = process.env.PORT || 3000;


var users = [];
var connections = [];
var checkGameStart = null;

var checkDieMemList = []; //다이버튼을 누른 멤버를 기록하는 배열
checkDieMemList.length = 0;


var bettingValue = 0; //실시간 현재 총 판돈 현황

var socketId = []; //소켓 아이디를 모아둠
var dataForCall; //콜을 위한 금액

//함수저장용
var arrFirstTurnButton = []; // ,을 기준으로 배열을 저장하는
var gameStartUserindex = ''; //게임이 진행될때 턴을 지정해주는 인덱스
var firstBettingValueForPing = null; //핑을위한 게임 맨처음 기본 베팅금액
var checkCall = 0; //call Count용
var checkCallPhase = 0; //첫번째 콜인지 두번째 콜인지 구분용
var winner = null; //마지막 승리자 저장용
var reasonForRematch = ''; //재경기 이유


var arrData; //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....이런식으로 저장
var randomValue = []; //arrData랑 같은개념인데 소켓아이디는 없고 카드번호만 순서대로 나열됨
var globalBettingV; //전체금액

var gameSetAmount = []; //이긴사람은 + 진사람은 - 로 표시 // 아이디1,금액, 아이디2,금액, 아이디3,금액...이런식

var checkPD = 0; //버튼제어를 위해서 동기화









app.get('/', function(req, res) { //이걸 실행해야 서버랑 소켓통신을 하는데 참조방법이 난감함
  res.sendFile(__dirname + '/index.html');
}).use(express.static(__dirname + '/route'));
//원래는이런방식 => app.use(express.static(__dirname+'/public'));  //하위경로 참조 방법
//근데 app뒤에 부분만 .으로 이어붙이면 기능이 추가되는듯 다른것도 비슷할듯


io.on('connection', function(socket) {

  socket.on('chat message', function(msg) {

    io.emit('chat message', msg);
  });

  //-----------------------------------------------------------------------------------
  //유저가 접속하면 socket에 콜백함



  //----------------------------------------------------------------------
  connections.push(socket); //conections라는 배열에 콜백된 socket의 내용을 추가
  var tempSocketId = socket.id
  socketId.push(tempSocketId); //socketId 변수에 소켓ID를 순서대로 넣는다(배열임)

  console.log('Connected: %s sockets connected', connections.length); //접속된사람이 몇명인지 출력하기위해 connections의 길이만큼 출력해줌


  //Disconnect받는거!!!!  -----유저들이 disconnect했을때
  socket.on('disconnect', function(data) {
    users.splice(users.indexOf(socket.username), 1); //유저배열중 username의 위치를 찾아서 지움
    socketId.splice(users.indexOf(socket.id), 1); //유저배열중 id의 위치를 찾아서 지움
    updateUsernames(); //유저정보를 클라이언트에 다 뿌리는 함수임(변경됐으니깐 뿌려줌)
    connections.splice(connections.indexOf(socket), 1); //connections배열에서 socket의 위치를 찾아서 1개삭제함
    console.log('Disconnected: %s sockets connected', connections.length);
  });

  //Send Message받고 보내는거!!!!------메시지를 클라이언트쪽으로 전부 뿌림
  socket.on('send message', function(data) { //send message를 키값으로지정하고 콜백으로 data
    console.log('메시지 데이터' + data);
    console.log(checkCall);
    //console.log('게임시작상태'+checkGameStart);



    io.sockets.emit('new message', {
      msg: data,
      user: socket.username
    }); //new message를 키값으로 data와 username을 뿌림
  });




  socket.on('checkPDC', function(data) { //send message를 키값으로지정하고 콜백으로 data

    console.log(data);
    checkPD = data;


    io.sockets.emit('checkPDS', checkPD);
  });









  //게임 시작버튼 ---클라이언트로값 받음 ----------start==처음한번만실행됨
  socket.on('game start', function(data) { //send message를 키값으로지정하고 콜백으로 data


    checkDieMemList = []; //다이멤버 리셋
    bettingValue = 0; //실시간 현재 총판돈 리셋
    dataForCall = 0; //콜을 위한 금액 리셋
    firstBettingValueForPing = 0; //핑을위한 게임 맨처음 기본 베팅금액 리셋
    checkCall = 0; //call Count용 리셋
    checkCallPhase = 0; //첫번째 콜인지 두번째 콜인지 구분용 리셋
    winner = null; //마지막 승리자 저장용 리셋
    reasonForRematch = ''; //재경기 이유 리셋
    arrData = ''; //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....이런식으로 저장 리셋
    randomValue = []; //arrData랑 같은개념인데 소켓아이디는 없고 카드번호만 순서대로 나열됨 리셋




    checkGameStart = 1;
    firstBettingValueForPing = data;
    var temp = null;


    //중복없는 랜덤 번호 만들기
    for (var i = 0; i < (users.length) * 2; i++) {
      randomValue[i] = Math.floor(Math.random() * 20) + 1;

      //중복제거 확인용
      for (var j = 0; j < i; j++) {
        if (randomValue[i] === randomValue[j]) {
          i = i - 1;
          break;
        }
      }
    }



    var socketIDandCardNum = '';
    var k = 0;
    //플레이어아뒤1,랜덤값1,랜덤값2,플레이어아뒤2,랜덤값3,랜덤값4,플레이어아뒤3,랜덤값5.....
    for (var i = 0; i < socketId.length; i++) {
      //console.log(socketId[i]);
      socketIDandCardNum += socketId[i] + ',';

      var t = 0;
      while (t < 2) {
        socketIDandCardNum += randomValue[k] + ',';
        k++;
        t++;
      }
      socketIDandCardNum += ',';
    }
    arrData = socketIDandCardNum.split(',') //,을 기준으로 배열로 만들어줌


    //빈배열공간을 지워줌
    while (true) {
      if (arrData.indexOf('') < 0) {
        break;
      }
      arrData.splice(arrData.indexOf(''), 1);
    }




    //플레이어 아뒤1, 베팅금액1, 플레이어아뒤2,베팅금액2....플레이어별 베팅금액 저장용
    var socketIDandBettingValue = '';
    for (var i = 0; i < socketId.length; i++) {
      socketIDandBettingValue += socketId[i] + ',';
      socketIDandBettingValue += data + ',';
    }


    //,을 기준으로 배열을 만들어줌
    globalBettingV = socketIDandBettingValue.split(',');

    //빈배열공간을 지워줌
    while (true) {
      if (globalBettingV.indexOf('') < 0) {
        break;
      }
      globalBettingV.splice(globalBettingV.indexOf(''), 1);
    }






    io.sockets.emit('ViwMycard message', {
      user: socket.username,
      socketIDnCardnum: arrData, //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....
      randomValue: randomValue, //랜덤값 배열 넘기기
      globalBettingV: globalBettingV //플레이어별 베팅금액 p1,bettingValue1,p2,bettingValue2....
    }); //new message를 키값으로 data와 username을 뿌림


  }); //--게임시작 end----------------






  //유저정보를 받아서 다음턴을 결정함 ----------start   --클라이언트에서 값 받음
  socket.on('CheckUser name', function(data) { //send message를 키값으로지정하고 콜백으로 data
    //console.log('다음턴을 지정하기위한 유저의 이름(기준)'+data);

    arrFirstTurnButton = []; // ,을 기준으로 배열을 저장 리셋
    gameStartUserindex = ''; //게임이 진행될때 턴을 지정해주는 인덱스 리셋

    bettingValue = data.bettingValue * users.length; //초기 베팅된 게임머니
    console.log(bettingValue);


    //-------순서지정하기위해 플레이어 에게 각각 다른 정보를 보내야함
    gameStartUserindex = socketId.indexOf(data.socketClientID); //---------------인덱스 이거랑
    //console.log('게임 시작한 유저의 인덱스::::'+gameStartUserindex);




    //하지만 인덱스가 총유저의 수보다 커버리거나 같다면

    if (users.length <= gameStartUserindex) {
      gameStartUserindex = 0; //순서 첫번째로 돌려야하기때문에
    }




    var socketId_for_Firstbutton = '';

    for (var i = 0; i < users.length; i++) {
      socketId_for_Firstbutton += socketId[i];
      socketId_for_Firstbutton += ',';
      //data.socketClientID===
      if (gameStartUserindex === i) {
        socketId_for_Firstbutton += 'show';
      } else {
        socketId_for_Firstbutton += 'hidden';
      }
      socketId_for_Firstbutton += ',';
    }



    arrFirstTurnButton = socketId_for_Firstbutton.split(',') //,을 기준으로 배열로 만들어줌

    //빈공간 배열""이 생겨서 지워줌
    arrFirstTurnButton.splice(arrFirstTurnButton.indexOf(""), 1);


    //정말 맨처음에~


    updateFirstButton('firstTurn button', users.length, socketId);

  }); //게임 시작시 턴 버튼 컨트롤----------end------------------









  //-----------------------------------call 버튼 관련 시작 받기--------------


  //본격적인 턴넘기기 버튼 ----------start   --클라이언트에서 값 받음
  socket.on('call button', function(data) { //send message를 키값으로지정하고 콜백으로 data



    bettingValue = Math.ceil(data.bettingValue + (dataForCall));

    console.log(bettingValue + '원');

    dataForCall = Math.ceil(dataForCall); //콜을위한 데이터

    console.log('콜을위한 값' + dataForCall);


    //string to num
    var sTnTemp = globalBettingV[(globalBettingV.indexOf(data.socketIdC)) + 1];
    sTnTemp = Number(sTnTemp) + Math.ceil(dataForCall);
    globalBettingV[(globalBettingV.indexOf(data.socketIdC)) + 1] = String(sTnTemp);

    console.log('콜 베팅금액 잘 적용됐는지::' + globalBettingV);



    //-------순서지정하기위해 플레이어 에게 각각 다른 정보를 보내야함
    gameStartUserindex = socketId.indexOf(data.socketIdC); //---------------인덱스 이거랑
    //console.log('게임 시작한 유저의 인덱스::::'+gameStartUserindex);









    console.log('넘겨받은소켓ID리스트:::' + data.starterMemList); //--------------------소켓아뒤 리스트 이거랑 ㅇㅇ


    gameStartUserindex++; //다음 유저에게 순서를 줘야하기때문에 1 2

    //하지만 인덱스가 총유저의 수보다 커버리거나 같다면

    if (data.starterLength <= gameStartUserindex) {
      gameStartUserindex = 0; //순서 첫번째로 돌려야하기때문에
    }


    var socketId_for_Firstbutton = '';

    for (var i = 0; i < data.starterLength; i++) {
      socketId_for_Firstbutton += data.starterMemList[i];
      socketId_for_Firstbutton += ',';

      if (gameStartUserindex === i) {
        socketId_for_Firstbutton += 'show';
      } else {
        socketId_for_Firstbutton += 'hidden';
      }
      socketId_for_Firstbutton += ',';
    }


    arrFirstTurnButton = socketId_for_Firstbutton.split(',') //,을 기준으로 배열로 만들어줌

    //빈공간 배열""이 생겨서 지워줌
    arrFirstTurnButton.splice(arrFirstTurnButton.indexOf(""), 1);




    checkCall = data.checkCall + 1;

    console.log('checkCall::' + checkCall);
    console.log('data.starterLength::' + data.starterLength);
    console.log(arrData);

    //--------------첫번째 콜 이벤트 발생시 두번째 카드 뒷면 공개----------------------------------------------
    if (checkCall >= ((data.starterLength - 1) - checkDieMemList.length) && checkCallPhase === 0) {
      checkCallPhase = 1;
      checkCall = 0;
      dataForCall = 0;
      updateFirstButton('firstCall showSecondcard', data.starterLength, data.starterMemList);


      //--------------두번째 콜 이벤트 발생시 게임셋----------------------------------------------
    } else if (checkCall >= ((data.starterLength - 1) - checkDieMemList.length) && checkCallPhase === 1) {

      checkGameStart = 0;



      //arrData 이 변수로 모든것을 다해야함

      //data.starterLength 유저길이

      //socketId
      //randomValue

      var rnArr = [];
      var rnArr2 = [];
      var k = 0;


      for (var i = 0; i < data.starterLength; i++) {
        //값1                값2
        var tempCon = null;
        tempCon = randomValue[k] + randomValue[k + 1];

        if ((randomValue[k] === 3 && randomValue[k + 1] === 8) ||
          (randomValue[k] === 8 && randomValue[k + 1] === 3)) {
          rnArr[i] = "38광땡";
          rnArr2[i] = 45;
        } else if ((randomValue[k] === 1 && randomValue[k + 1] === 8) ||
          (randomValue[k] === 8 && randomValue[k + 1] === 1)) {
          rnArr[i] = "18광땡";
          rnArr2[i] = 43;
        } else if ((randomValue[k] === 1 && randomValue[k + 1] === 3) ||
          (randomValue[k] === 3 && randomValue[k + 1] === 1)) {
          rnArr[i] = "13광땡";
          rnArr2[i] = 42;
        } else if ((randomValue[k] % 10 === randomValue[k + 1] % 10)) {


          if (((randomValue[k] + randomValue[k + 1]) % 10) === 0) {
            rnArr[i] = "장땡";
            rnArr2[i] = 41;
          } else {
            rnArr[i] = String(randomValue[k] % 10) + "땡";
            rnArr2[i] = randomValue[k] % 10 + 30; //39:9땡 ~ 31:1땡
          }

        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 2) ||
          (randomValue[k] % 10 === 2 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "알리";
          rnArr2[i] = 30;
        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 4) ||
          (randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "독사";
          rnArr2[i] = 29;
        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 9) ||
          (randomValue[k] % 10 === 9 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "구삥";
          rnArr2[i] = 28;
        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 0) ||
          (randomValue[k] % 10 === 0 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "장삥";
          rnArr2[i] = 27;
        } else if ((randomValue[k] % 10 === 0 && randomValue[k + 1] % 10 === 4) ||
          (randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 0)) {
          rnArr[i] = "장사";
          rnArr2[i] = 26;
        } else if ((randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 6) ||
          (randomValue[k] % 10 === 6 && randomValue[k + 1] % 10 === 4)) {
          rnArr[i] = "세륙";
          rnArr2[i] = 25;
        } else if ((randomValue[k] + randomValue[k + 1]) % 10 === 9) {
          rnArr[i] = "갑오";
          rnArr2[i] = 24;
        } else if ((randomValue[k] === 4 && randomValue[k + 1] === 7) ||
          (randomValue[k] === 7 && randomValue[k + 1] === 4)) {
          rnArr[i] = "47암행어사";
          rnArr2[i] = 14;
        } else if ((randomValue[k] === 3 && randomValue[k + 1] === 7) ||
          (randomValue[k] === 7 && randomValue[k + 1] === 3)) {
          rnArr[i] = "땡잡이";
          rnArr2[i] = 13;
        } else if ((randomValue[k] === 4 && randomValue[k + 1] === 19) ||
          (randomValue[k] === 19 && randomValue[k + 1] === 4)) {
          rnArr[i] = "멍텅구리 구사";
          rnArr2[i] = 12;
        } else if ((randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 9) ||
          (randomValue[k] % 10 === 9 && randomValue[k + 1] % 10 === 4)) {
          rnArr[i] = "구사";
          rnArr2[i] = 11;
        } else if (((randomValue[k] + randomValue[k + 1]) % 10 === 8) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 7) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 6) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 5) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 4) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 3) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 2) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 1)) {
          rnArr[i] = String((randomValue[k] + randomValue[k + 1]) % 10) + "끗";
          rnArr2[i] = (((randomValue[k] + randomValue[k + 1]) % 10) + 15); //23 8끗 기준
        } else if ((randomValue[k] + randomValue[k + 1]) % 10 === 0) {
          rnArr[i] = "망통";
          rnArr2[i] = 15;
        }

        //체크포인트
        k += 2;
      }



      //암행어사 처리
      if ((rnArr2.indexOf(14) >= 0) &&
        ((rnArr2.indexOf(43) >= 0) ||
          (rnArr2.indexOf(42) >= 0)
        )) {
        rnArr2[rnArr2.indexOf(14)] = 44; //13,18보다 위로 격상
      } else {
        rnArr2[rnArr2.indexOf(14)] = 16; //조건에 안맞으면 1끗 넣어줌
      }





      //땡잡이처리
      if ((rnArr2.indexOf(13) >= 0) &&
        ((rnArr2.indexOf(39) >= 0) ||
          (rnArr2.indexOf(38) >= 0) ||
          (rnArr2.indexOf(37) >= 0) ||
          (rnArr2.indexOf(35) >= 0) ||
          (rnArr2.indexOf(34) >= 0) ||
          (rnArr2.indexOf(33) >= 0) ||
          (rnArr2.indexOf(36) >= 0) ||
          (rnArr2.indexOf(32) >= 0) ||
          (rnArr2.indexOf(31) >= 0)
        )) {
        rnArr2[rnArr2.indexOf(13)] = 40; // 1~9땡보다 위로 격상
      } else {
        rnArr2[rnArr2.indexOf(13)] = 15; //조건에 안맞으면 망통에 넣어줌
      }





      //최대값을찾는다 (멍사구,사구 조건처리용)
      var maxValueT = Math.max.apply(null, rnArr2);





      //멍텅구리 사구 처리   장땡이하 재경기  다이멤머를 제외한 전부 재경기
      if ((rnArr2.indexOf(12) >= 0) &&
        (maxValueT <= 41)) {
        //재경기 하는 코드 짜셈

        console.log('멍사구 작동');


        checkCallPhase = 1;
        checkCall = 0;



        randomValue = []; //랜덤카드변수 초기화
        //중복없는 랜덤 번호 만들기
        for (var i = 0; i < (data.starterMemList.length) * 2; i++) {
          randomValue[i] = Math.floor(Math.random() * 19) + 1;

          //중복제거 확인용
          for (var j = 0; j < i; j++) {
            if (randomValue[i] === randomValue[j]) {
              i = i - 1;
              break;
            }
          }
        }
        console.log('randomValue~' + randomValue);





        //console.log('랜덤값' + randomValue);
        //console.log('--------------확인--------------');
        var socketIDandCardNum = '';

        var k = 0;
        //플레이어아뒤1,랜덤값1,랜덤값2,플레이어아뒤2,랜덤값3,랜덤값4,플레이어아뒤3,랜덤값5.....
        for (var i = 0; i < data.starterMemList.length; i++) {
          //console.log(socketId[i]);
          socketIDandCardNum += data.starterMemList[i] + ',';

          var t = 0;
          while (t < 2) {
            socketIDandCardNum += randomValue[k] + ',';
            k++;
            t++;
          }
          socketIDandCardNum += ',';
        }
        arrData = socketIDandCardNum.split(',') //,을 기준으로 배열로 만들어줌


        //빈배열공간을 지워줌
        while (true) {
          if (arrData.indexOf('') < 0) {
            break;
          }
          arrData.splice(arrData.indexOf(''), 1);
        }


        console.log(arrData);


        reasonForRematch = "멍구사"; //재경기 이유






        io.sockets.emit('again message', {
          //user: socket.username + "패나누기",
          socketIDnCardnum: arrData, //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....
          randomValue: randomValue, //랜덤값 배열 넘기기
          reasonForRematch: reasonForRematch, //재경기 이유
          globalBettingV: globalBettingV //플레이어별 베팅금액 p1,bettingValue1,p2,bettingValue2....
        });


        dataForCall = 0;

        //바로 첫번째 콜 이벤트 발생으로 진행
        updateFirstButton('firstCall showSecondcard', data.starterLength, data.starterMemList);

        //console.log('재시합~'); //배열(유저게임수 만큼 존재


        //console.log('구사 작동함!!!!!!!!!!!!');
        return; //함수탈툴


      } else {
        console.log('멍구사 작동ㄴㄴㄴㄴ');
        rnArr2[rnArr2.indexOf(12)] = 18; //멍텅구리 사구 조건에 안맞으면 3끗 넣어줌
      }








      //구사 처리   알리 이하 재경기-----------------
      if ((rnArr2.indexOf(11) >= 0) && (maxValueT <= 30)) {
        //재경기하는 코드 짜셈

        //알리이하면 재경기(다이멤버 제외)
        //재시합하는 코딩하면됨.  emit으로 보내서 다른 이벤트(재승부)를 발생시킴
        //여기서 재시합기준은 최대값을 가진사람들끼리 승부 다이멤버만 조절해주면됨


        checkCallPhase = 1;
        checkCall = 0;



        randomValue = []; //랜덤카드변수 초기화
        //중복없는 랜덤 번호 만들기
        for (var i = 0; i < (data.starterMemList.length) * 2; i++) {
          randomValue[i] = Math.floor(Math.random() * 19) + 1;

          //중복제거 확인용
          for (var j = 0; j < i; j++) {
            if (randomValue[i] === randomValue[j]) {
              i = i - 1;
              break;
            }
          }
        }
        console.log('randomValue~' + randomValue);





        //console.log('랜덤값' + randomValue);
        //console.log('--------------확인--------------');
        var socketIDandCardNum = '';

        var k = 0;
        //플레이어아뒤1,랜덤값1,랜덤값2,플레이어아뒤2,랜덤값3,랜덤값4,플레이어아뒤3,랜덤값5.....
        for (var i = 0; i < data.starterMemList.length; i++) {
          //console.log(socketId[i]);
          socketIDandCardNum += data.starterMemList[i] + ',';

          var t = 0;
          while (t < 2) {
            socketIDandCardNum += randomValue[k] + ',';
            k++;
            t++;
          }
          socketIDandCardNum += ',';
        }
        arrData = socketIDandCardNum.split(',') //,을 기준으로 배열로 만들어줌


        //빈배열공간을 지워줌
        while (true) {
          if (arrData.indexOf('') < 0) {
            break;
          }
          arrData.splice(arrData.indexOf(''), 1);
        }


        console.log(arrData);



        reasonForRematch = "구사";

        io.sockets.emit('again message', {
          //user: socket.username + "패나누기",
          socketIDnCardnum: arrData, //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....
          randomValue: randomValue, //랜덤값 배열 넘기기
          reasonForRematch: reasonForRematch,
          globalBettingV: globalBettingV //플레이어별 베팅금액 p1,bettingValue1,p2,bettingValue2....
        });

        //재경기 인덱스를 추가할 emit을 따로 작성하기

        dataForCall = 0;
        //바로 첫번째 콜 이벤트 발생으로 진행
        updateFirstButton('firstCall showSecondcard', data.starterLength, data.starterMemList);

        //console.log('재시합~'); //배열(유저게임수 만큼 존재


        //console.log('구사 작동함!!!!!!!!!!!!');


        return; //함수탈툴



      } else {
        rnArr2[rnArr2.indexOf(11)] = 18; //알리가조건에 안맞으면 3끗 넣어줌
        //console.log('구사 작동xxxxxxxxxxxxxxxxxxxxxxxx');

      }




      var dieMemIndex = []; //다이멤버의 인덱스를 찾아줌
      for (var i = 0; i < checkDieMemList.length; i++) {
        dieMemIndex[i] = data.starterMemList.indexOf(checkDieMemList[i]);
      }




      //찾은 다이멤버 인덱스를 찾아서 우선순위 인덱스를 수정(다이멤버가 존재시 해당 위치의 값을 -1로 지정)
      if (dieMemIndex.length >= 0) {
        for (var i = 0; i < data.starterLength; i++) {
          if (dieMemIndex.indexOf(i) >= 0) {
            rnArr2[i] = -1;
          }
        }
      }



      var maxValue = Math.max.apply(null, rnArr2); //최대값을찾는다 (승리자 찾음)



      var checkAgainPoint = -1; //재시합의 기준
      var maxValueIndexForOverlap = []; //승리자 중복시 인덱스를 저장(재경기를 위해서)
      for (var i = 0; i < rnArr2.length; i++) {
        if (rnArr2[i] === maxValue) { //최대값이 있을때마다 체크해줌
          checkAgainPoint += 1;
          maxValueIndexForOverlap.push(i); //중복되는 인덱스를 배열에 넣어줌
        }
      }







      //최고값승리자 중복시 재경시 시작!!!!!!!!!!!!!!!--- 아닐시 게임섻----------------------------------
      if (checkAgainPoint >= 1) { //최대값을 가지지 못한사람은 다 다이멤버로 포함시켜서 처리한다.
        //재시합하는 코딩하면됨.  emit으로 보내서 다른 이벤트(재승부)를 발생시킴
        //여기서 재시합기준은 최대값을 가진사람들끼리 승부 다이멤버만 조절해주면됨

        //console.log('재경기 작동함');


        checkCallPhase = 1;
        checkCall = 0;
        checkDieMemList = []; //다이멤버 초기화



        //maxValueIndexForOverlap에 중복안되는 인덱스는 다 다이멤버로 넣어줌
        for (var i = 0; i < data.starterMemList.length; i++) {
          if (maxValueIndexForOverlap.indexOf(i) >= 0) {
            continue;
          } else {
            checkDieMemList.push(data.starterMemList[i]);
          }
        }
        //console.log('다이 멤버좀 봅시다' + checkDieMemList);

        randomValue = []; //랜덤카드변수 초기화
        //중복없는 랜덤 번호 만들기
        for (var i = 0; i < (data.starterMemList.length) * 2; i++) {
          randomValue[i] = Math.floor(Math.random() * 19) + 1;

          //중복제거 확인용
          for (var j = 0; j < i; j++) {
            if (randomValue[i] === randomValue[j]) {
              i = i - 1;
              break;
            }
          }
        }
        console.log('randomValue~' + randomValue);





        //console.log('랜덤값' + randomValue);
        //console.log('--------------확인--------------');
        var socketIDandCardNum = '';

        var k = 0;
        //플레이어아뒤1,랜덤값1,랜덤값2,플레이어아뒤2,랜덤값3,랜덤값4,플레이어아뒤3,랜덤값5.....
        for (var i = 0; i < data.starterMemList.length; i++) {
          //console.log(socketId[i]);
          socketIDandCardNum += data.starterMemList[i] + ',';

          var t = 0;
          while (t < 2) {
            socketIDandCardNum += randomValue[k] + ',';
            k++;
            t++;
          }
          socketIDandCardNum += ',';
        }
        arrData = socketIDandCardNum.split(',') //,을 기준으로 배열로 만들어줌


        //빈배열공간을 지워줌
        while (true) {
          if (arrData.indexOf('') < 0) {
            break;
          }
          arrData.splice(arrData.indexOf(''), 1);
        }


        console.log(arrData);


        reasonForRematch = "무승부";


        io.sockets.emit('again message', {
          //user: socket.username + "패나누기",
          socketIDnCardnum: arrData, //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....
          randomValue: randomValue, //랜덤값 배열 넘기기
          reasonForRematch: reasonForRematch, //재경기 이유
          globalBettingV: globalBettingV //플레이어별 베팅금액 p1,bettingValue1,p2,bettingValue2....
        });



        dataForCall = 0;
        //바로 첫번째 콜 이벤트 발생으로 진행
        updateFirstButton('firstCall showSecondcard', data.starterLength, data.starterMemList);

        //console.log('재시합~'); //배열(유저게임수 만큼 존재
        return;


      } else { //end of 재시합`
        var maxValueIndex = rnArr2.indexOf(maxValue); //최대값의 인덱스를 찾는다


        console.log('최고값 인덱스' + maxValueIndex); //최고 값 인덱스
        console.log('재시합기준값' + checkAgainPoint); //재시합의 기준값



        console.log(rnArr); //배열(유저게임수 만큼 존재
        console.log(rnArr2); //배열(유저게임수 만큼 존재

        var gameSetdata = [];


        //승리자 아이디 이걸가지고승리자만 따로이벤트하고 나머진 패배
        winner = data.starterMemList[maxValueIndex];

        //bettingValue
        //winner

        gameSetAmount = globalBettingV;

        //console.log('승리자!!'+gameSetAmount.indexOf(winner));





        gameSetAmount[gameSetAmount.indexOf(winner) + 1] = String(bettingValue - parseInt(gameSetAmount[gameSetAmount.indexOf(winner) + 1]));



        console.log('처리전' + gameSetAmount);

        //console.log(String( bettingValue - parseInt(gameSetAmount[gameSetAmount.indexOf(winner)+1]) ));


        for (var i = 0; i < gameSetAmount.length; i += 2) { //승자만 + 나머진 -처리

          if (gameSetAmount.indexOf(winner) === i) {
            continue;
          } else {
            gameSetAmount[i + 1] = String(parseInt(gameSetAmount[i + 1] * (-1)));
          }
        }

        console.log('처리후' + gameSetAmount);





        //게임셋 돌아오기123 parseInt(firstBettingValueForPing) String(sTnTemp);




        // 여기서 개임셋할때 emit 정보 -- 보내기
        io.sockets.emit('secondCall gameset', {
          Turnmsg: arrFirstTurnButton, // 턴넘기기 버튼활성화인덱스 정보가 들어간 배열변수 유저아이디,인덱스,유저아이디2,인덱스2...이런식
          usersLength: data.starterLength, //유저의 길이 넘겨줌
          socketIDList: data.starterMemList, //유저 리스트 넘겨줌
          checkCall: checkCall, //콜버튼 스택확인용
          bettingValue: bettingValue, //베팅 금액  아직 지정안됨
          checkDieMemList: checkDieMemList, //다이멤버 리스트
          dataForCall: dataForCall, //call을 위한 금액 저장
          rnArr: rnArr, //카드 결과 정보 문자
          winner: winner //최종 승리자 아이디
        });
        return;
      }



    }





    //firstTurnButton emit
    updateFirstButton('firstTurn button', data.starterLength, data.starterMemList);


  }); //본격적인 콜 버튼 컨트롤----------end------------------








  //따당: 앞사람이 건 돈의 2배를 베팅한다.
  //-------------------------따당 버튼 관련 시작 받기---------------------


  //본격적인 턴넘기기 버튼 ----------start   --클라이언트에서 값 받음
  socket.on('double button', function(data) { //send message를 키값으로지정하고 콜백으로 data


    bettingValue = Math.ceil(data.bettingValue + (dataForCall * 2));

    console.log(bettingValue + '원');

    dataForCall = Math.ceil(dataForCall * 2); //콜을위한 데이터

    console.log('콜을위한 값' + dataForCall);

    checkCall = 0; //레이즈시 call인덱스 초기화


    //string to num
    var sTnTemp = globalBettingV[(globalBettingV.indexOf(data.socketIdC)) + 1];
    sTnTemp = Number(sTnTemp) + Math.ceil(dataForCall * 2);
    globalBettingV[(globalBettingV.indexOf(data.socketIdC)) + 1] = String(sTnTemp);

    console.log('따당 베팅금액 잘 적용됐는지::' + globalBettingV);





    //-------순서지정하기위해 플레이어 에게 각각 다른 정보를 보내야함
    gameStartUserindex = socketId.indexOf(data.socketIdC); //---------------인덱스 이거랑
    //console.log('게임 시작한 유저의 인덱스::::'+gameStartUserindex);


    //게임시작했던 유저의 인원정보--------
    //console.log('유저의 인원수'+data.starterLength);  //--------------------총 유저의수 이거랑



    console.log('넘겨받은소켓ID리스트:::' + data.starterMemList); //--------------------소켓아뒤 리스트 이거랑 ㅇㅇ


    gameStartUserindex++; //다음 유저에게 순서를 줘야하기때문에 1 2

    //하지만 인덱스가 총유저의 수보다 커버리거나 같다면

    if (data.starterLength <= gameStartUserindex) {
      gameStartUserindex = 0; //순서 첫번째로 돌려야하기때문에
    }


    var socketId_for_Firstbutton = '';

    for (var i = 0; i < data.starterLength; i++) {
      socketId_for_Firstbutton += data.starterMemList[i];
      socketId_for_Firstbutton += ',';

      if (gameStartUserindex === i) {
        socketId_for_Firstbutton += 'show';
      } else {
        socketId_for_Firstbutton += 'hidden';
      }
      socketId_for_Firstbutton += ',';
    }


    arrFirstTurnButton = socketId_for_Firstbutton.split(',') //,을 기준으로 배열로 만들어줌

    //빈공간 배열""이 생겨서 지워줌
    arrFirstTurnButton.splice(arrFirstTurnButton.indexOf(""), 1);



    //firstTurnButton emit
    updateFirstButton('firstTurn button', data.starterLength, data.starterMemList);




  }); //본격적인 따당 버튼 컨트롤----------end------------------









  //-----------------------------------하프 버튼 관련 시작 받기--------------

  //본격적인 턴넘기기 버튼 ----------start   --클라이언트에서 값 받음
  socket.on('half button', function(data) { //send message를 키값으로지정하고 콜백으로 data

    bettingValue = Math.ceil((data.bettingValue + (data.bettingValue * 0.5)));

    console.log(bettingValue + '원');

    dataForCall = Math.ceil((data.bettingValue * 0.5)); //콜을위한 데이터

    console.log('콜을위한 값' + dataForCall);


    checkCall = 0; //레이즈시 call인덱스 초기화


    //string to num
    var sTnTemp = globalBettingV[(globalBettingV.indexOf(data.socketIdC)) + 1];
    sTnTemp = Number(sTnTemp) + Math.ceil(data.bettingValue * 0.5);
    globalBettingV[(globalBettingV.indexOf(data.socketIdC)) + 1] = String(sTnTemp);

    console.log('하프 베팅금액 잘 적용됐는지::' + globalBettingV);





    //-------순서지정하기위해 플레이어 에게 각각 다른 정보를 보내야함
    gameStartUserindex = socketId.indexOf(data.socketIdC); //---------------인덱스 이거랑
    //console.log('게임 시작한 유저의 인덱스::::'+gameStartUserindex);


    //게임시작했던 유저의 인원정보--------
    //console.log('유저의 인원수'+data.starterLength);  //--------------------총 유저의수 이거랑



    console.log('넘겨받은소켓ID리스트:::' + data.starterMemList); //--------------------소켓아뒤 리스트 이거랑 ㅇㅇ


    gameStartUserindex++; //다음 유저에게 순서를 줘야하기때문에 1 2

    //하지만 인덱스가 총유저의 수보다 커버리거나 같다면

    if (data.starterLength <= gameStartUserindex) {
      gameStartUserindex = 0; //순서 첫번째로 돌려야하기때문에
    }


    var socketId_for_Firstbutton = '';

    for (var i = 0; i < data.starterLength; i++) {
      socketId_for_Firstbutton += data.starterMemList[i];
      socketId_for_Firstbutton += ',';

      if (gameStartUserindex === i) {
        socketId_for_Firstbutton += 'show';
      } else {
        socketId_for_Firstbutton += 'hidden';
      }
      socketId_for_Firstbutton += ',';
    }


    arrFirstTurnButton = socketId_for_Firstbutton.split(',') //,을 기준으로 배열로 만들어줌

    //빈공간 배열""이 생겨서 지워줌
    arrFirstTurnButton.splice(arrFirstTurnButton.indexOf(""), 1);


    io.sockets.emit('some otherV', {
      globalBettingV: globalBettingV //플레이어별 베팅금액 p1,bettingValue1,p2,bettingValue2....
    }); //new message를 키값으로 data와 username을 뿌림


    //firstTurnButton emit
    updateFirstButton('firstTurn button', data.starterLength, data.starterMemList);


  }); //본격적인 히프 버튼 컨트롤----------end------------------








  //쿼터: 깔린 돈의 25%를 베팅한다.
  //--------------------------쿼터 버튼 관련 시작 받기--------------

  //본격적인 턴넘기기 버튼 ----------start   --클라이언트에서 값 받음
  socket.on('quarter button', function(data) { //send message를 키값으로지정하고 콜백으로 data

    bettingValue = Math.ceil((data.bettingValue + (data.bettingValue * 0.25)));

    console.log(bettingValue + '원');

    dataForCall = Math.ceil((data.bettingValue * 0.25)); //콜을위한 데이터

    console.log('콜을위한 값' + dataForCall);




    //string to num
    var sTnTemp = globalBettingV[(globalBettingV.indexOf(data.socketIdC)) + 1];
    sTnTemp = Number(sTnTemp) + Math.ceil(data.bettingValue * 0.25);
    globalBettingV[(globalBettingV.indexOf(data.socketIdC)) + 1] = String(sTnTemp);

    console.log('쿼터 베팅금액 잘 적용됐는지::' + globalBettingV);



    checkCall = 0; //레이즈시 call인덱스 초기화

    //-------순서지정하기위해 플레이어 에게 각각 다른 정보를 보내야함
    gameStartUserindex = socketId.indexOf(data.socketIdC); //---------------인덱스 이거랑

    gameStartUserindex++; //다음 유저에게 순서를 줘야하기때문에 1 2

    //하지만 인덱스가 총유저의 수보다 커버리거나 같다면
    if (data.starterLength <= gameStartUserindex) {
      gameStartUserindex = 0; //순서 첫번째로 돌려야하기때문에
    }



    var socketId_for_Firstbutton = '';

    for (var i = 0; i < data.starterLength; i++) {
      socketId_for_Firstbutton += data.starterMemList[i];
      socketId_for_Firstbutton += ',';

      if (gameStartUserindex === i) {
        socketId_for_Firstbutton += 'show';
      } else {
        socketId_for_Firstbutton += 'hidden';
      }
      socketId_for_Firstbutton += ',';
    }


    arrFirstTurnButton = socketId_for_Firstbutton.split(',') //,을 기준으로 배열로 만들어줌

    //빈공간 배열""이 생겨서 지워줌
    arrFirstTurnButton.splice(arrFirstTurnButton.indexOf(""), 1);


    //firstTurnButton emit
    updateFirstButton('firstTurn button', data.starterLength, data.starterMemList);


  }); //본격적인 쿼터 버튼 컨트롤----------end------------------









  //삥: 기본단위만큼을 베팅한다. 선을 잡은 사람에 한해 1장째, 또는 2장째 처음에 한해 가능.
  //--------------------------삥 버튼 관련 시작 받기--------------

  //본격적인 턴넘기기 버튼 ----------start   --클라이언트에서 값 받음
  socket.on('ping button', function(data) { //send message를 키값으로지정하고 콜백으로 data

    bettingValue = Math.ceil((data.bettingValue + parseInt(firstBettingValueForPing)));

    console.log(bettingValue + '원');

    dataForCall = Math.ceil(parseInt(firstBettingValueForPing)); //콜을위한 데이터

    console.log('콜을위한 값' + dataForCall);


    //string to num
    var sTnTemp = globalBettingV[(globalBettingV.indexOf(data.socketIdC)) + 1];
    sTnTemp = Number(sTnTemp) + Math.ceil(Number(firstBettingValueForPing));
    globalBettingV[(globalBettingV.indexOf(data.socketIdC)) + 1] = String(sTnTemp);

    console.log('삥 베팅금액 잘 적용됐는지::' + globalBettingV);


    checkCall = 0; //레이즈시 call인덱스 초기화




    //-------순서지정하기위해 플레이어 에게 각각 다른 정보를 보내야함
    gameStartUserindex = socketId.indexOf(data.socketIdC); //---------------인덱스 이거랑

    gameStartUserindex++; //다음 유저에게 순서를 줘야하기때문에 1 2

    //하지만 인덱스가 총유저의 수보다 커버리거나 같다면
    if (data.starterLength <= gameStartUserindex) {
      gameStartUserindex = 0; //순서 첫번째로 돌려야하기때문에
    }



    var socketId_for_Firstbutton = '';

    for (var i = 0; i < data.starterLength; i++) {
      socketId_for_Firstbutton += data.starterMemList[i];
      socketId_for_Firstbutton += ',';

      if (gameStartUserindex === i) {
        socketId_for_Firstbutton += 'show';
      } else {
        socketId_for_Firstbutton += 'hidden';
      }
      socketId_for_Firstbutton += ',';
    }


    arrFirstTurnButton = socketId_for_Firstbutton.split(',') //,을 기준으로 배열로 만들어줌

    //빈공간 배열""이 생겨서 지워줌
    arrFirstTurnButton.splice(arrFirstTurnButton.indexOf(""), 1);


    //firstTurnButton emit
    updateFirstButton('firstTurn button', data.starterLength, data.starterMemList);


  }); //본격적인 삥 버튼 컨트롤----------end------------------









  //-----------------------------------다이 버튼 관련 시작 받기--------------

  //본격적인 턴넘기기 버튼 ----------start   --클라이언트에서 값 받음
  socket.on('die button', function(data) { //send message를 키값으로지정하고 콜백으로 data

    bettingValue = Math.ceil((data.bettingValue + (data.bettingValue * 0.5)));

    console.log(bettingValue + '원');



    checkDieMemList.push(data.socketIdC); //다이버튼 클릭한 소켓아이디를 체크
    //다이버튼을 누른 멤버의 인덱스를 넘김
    console.log('다이멤버' + checkDieMemList);




    //-------순서지정하기위해 플레이어 에게 각각 다른 정보를 보내야함
    gameStartUserindex = socketId.indexOf(data.socketIdC); //---------------인덱스 이거랑
    //console.log('게임 시작한 유저의 인덱스::::'+gameStartUserindex);







    console.log('넘겨받은소켓ID리스트:::' + data.starterMemList); //--------------------소켓아뒤 리스트 이거랑 ㅇㅇ


    gameStartUserindex++; //다음 유저에게 순서를 줘야하기때문에 1 2




    //하지만 인덱스가 총유저의 수보다 커버리거나 같다면
    if (data.starterLength <= gameStartUserindex) {
      gameStartUserindex = 0; //순서 첫번째로 돌려야하기때문에
    } else {

    }


    var socketId_for_Firstbutton = '';


    //이부분을 전체 다바꾸어야함ㅇㅇㅇㅇ ㅅㄱ
    for (var i = 0; i < data.starterLength; i++) {
      socketId_for_Firstbutton += data.starterMemList[i];
      socketId_for_Firstbutton += ',';

      if (gameStartUserindex === i) {
        socketId_for_Firstbutton += 'show';
      } else {
        socketId_for_Firstbutton += 'hidden';
      }
      socketId_for_Firstbutton += ',';
    }


    arrFirstTurnButton = socketId_for_Firstbutton.split(',') //,을 기준으로 배열로 만들어줌

    //빈공간 배열""이 생겨서 지워줌
    arrFirstTurnButton.splice(arrFirstTurnButton.indexOf(""), 1);

    console.log('die button에서 실행됨 checkcall값' + data.checkCall)
    console.log('die button에서 실행됨 뒤조건값' + ((data.starterLength - 1) - checkDieMemList.length))


    //---------------첫번째 레이즈때 다 죽었을경우 게임셋
    if (checkDieMemList.length >= data.starterLength - 1) {

      checkGameStart = 0;


      var rnArr = [];
      var rnArr2 = [];
      var k = 0;


      for (var i = 0; i < data.starterLength; i++) {
        //값1                값2
        var tempCon = null;
        tempCon = randomValue[k] + randomValue[k + 1];

        if ((randomValue[k] === 3 && randomValue[k + 1] === 8) ||
          (randomValue[k] === 8 && randomValue[k + 1] === 3)) {
          rnArr[i] = "38광땡";
          rnArr2[i] = 45;
        } else if ((randomValue[k] === 1 && randomValue[k + 1] === 8) ||
          (randomValue[k] === 8 && randomValue[k + 1] === 1)) {
          rnArr[i] = "18광땡";
          rnArr2[i] = 43;
        } else if ((randomValue[k] === 1 && randomValue[k + 1] === 3) ||
          (randomValue[k] === 3 && randomValue[k + 1] === 1)) {
          rnArr[i] = "13광땡";
          rnArr2[i] = 42;
        } else if ((randomValue[k] % 10 === randomValue[k + 1] % 10)) {


          if (((randomValue[k] + randomValue[k + 1]) % 10) === 0) {
            rnArr[i] = "장땡";
            rnArr2[i] = 41;
          } else {
            rnArr[i] = String(randomValue[k] % 10) + "땡";
            rnArr2[i] = randomValue[k] % 10 + 30; //39:9땡 ~ 31:1땡
          }

        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 2) ||
          (randomValue[k] % 10 === 2 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "알리";
          rnArr2[i] = 30;
        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 4) ||
          (randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "독사";
          rnArr2[i] = 29;
        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 9) ||
          (randomValue[k] % 10 === 9 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "구삥";
          rnArr2[i] = 28;
        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 0) ||
          (randomValue[k] % 10 === 0 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "장삥";
          rnArr2[i] = 27;
        } else if ((randomValue[k] % 10 === 0 && randomValue[k + 1] % 10 === 4) ||
          (randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 0)) {
          rnArr[i] = "장사";
          rnArr2[i] = 26;
        } else if ((randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 6) ||
          (randomValue[k] % 10 === 6 && randomValue[k + 1] % 10 === 4)) {
          rnArr[i] = "세륙";
          rnArr2[i] = 25;
        } else if ((randomValue[k] + randomValue[k + 1]) % 10 === 9) {
          rnArr[i] = "갑오";
          rnArr2[i] = 24;
        } else if ((randomValue[k] === 4 && randomValue[k + 1] === 7) ||
          (randomValue[k] === 7 && randomValue[k + 1] === 4)) {
          rnArr[i] = "47암행어사";
          rnArr2[i] = 14;
        } else if ((randomValue[k] === 3 && randomValue[k + 1] === 7) ||
          (randomValue[k] === 7 && randomValue[k + 1] === 3)) {
          rnArr[i] = "땡잡이";
          rnArr2[i] = 13;
        } else if ((randomValue[k] === 4 && randomValue[k + 1] === 19) ||
          (randomValue[k] === 19 && randomValue[k + 1] === 4)) {
          rnArr[i] = "멍텅구리 구사";
          rnArr2[i] = 12;
        } else if ((randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 9) ||
          (randomValue[k] % 10 === 9 && randomValue[k + 1] % 10 === 4)) {
          rnArr[i] = "구사";
          rnArr2[i] = 11;
        } else if (((randomValue[k] + randomValue[k + 1]) % 10 === 8) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 7) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 6) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 5) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 4) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 3) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 2) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 1)) {
          rnArr[i] = String((randomValue[k] + randomValue[k + 1]) % 10) + "끗";
          rnArr2[i] = (((randomValue[k] + randomValue[k + 1]) % 10) + 15); //23 8끗 기준
        } else if ((randomValue[k] + randomValue[k + 1]) % 10 === 0) {
          rnArr[i] = "망통";
          rnArr2[i] = 15;
        }

        //체크포인트
        k += 2;
      }



      //암행어사 처리
      if ((rnArr2.indexOf(14) >= 0) &&
        ((rnArr2.indexOf(43) >= 0) ||
          (rnArr2.indexOf(42) >= 0)
        )) {
        rnArr2[rnArr2.indexOf(14)] = 44; //13,18보다 위로 격상
      } else {
        rnArr2[rnArr2.indexOf(14)] = 16; //조건에 안맞으면 1끗 넣어줌
      }





      //땡잡이처리
      if ((rnArr2.indexOf(13) >= 0) &&
        ((rnArr2.indexOf(39) >= 0) ||
          (rnArr2.indexOf(38) >= 0) ||
          (rnArr2.indexOf(37) >= 0) ||
          (rnArr2.indexOf(35) >= 0) ||
          (rnArr2.indexOf(34) >= 0) ||
          (rnArr2.indexOf(33) >= 0) ||
          (rnArr2.indexOf(36) >= 0) ||
          (rnArr2.indexOf(32) >= 0) ||
          (rnArr2.indexOf(31) >= 0)
        )) {
        rnArr2[rnArr2.indexOf(13)] = 40; // 1~9땡보다 위로 격상
      } else {
        rnArr2[rnArr2.indexOf(13)] = 15; //조건에 안맞으면 망통에 넣어줌
      }





      //최대값을찾는다 (멍사구,사구 조건처리용)
      var maxValueT = Math.max.apply(null, rnArr2);





      //멍텅구리 사구 처리   장땡이하 재경기  다이멤머를 제외한 전부 재경기
      if ((rnArr2.indexOf(12) >= 0) &&
        (maxValueT <= 41)) {
        //재경기 하는 코드 짜셈

        console.log('멍사구 작동');


        checkCallPhase = 1;
        checkCall = 0;



        randomValue = []; //랜덤카드변수 초기화
        //중복없는 랜덤 번호 만들기
        for (var i = 0; i < (data.starterMemList.length) * 2; i++) {
          randomValue[i] = Math.floor(Math.random() * 19) + 1;

          //중복제거 확인용
          for (var j = 0; j < i; j++) {
            if (randomValue[i] === randomValue[j]) {
              i = i - 1;
              break;
            }
          }
        }
        console.log('randomValue~' + randomValue);





        //console.log('랜덤값' + randomValue);
        //console.log('--------------확인--------------');
        var socketIDandCardNum = '';

        var k = 0;
        //플레이어아뒤1,랜덤값1,랜덤값2,플레이어아뒤2,랜덤값3,랜덤값4,플레이어아뒤3,랜덤값5.....
        for (var i = 0; i < data.starterMemList.length; i++) {
          //console.log(socketId[i]);
          socketIDandCardNum += data.starterMemList[i] + ',';

          var t = 0;
          while (t < 2) {
            socketIDandCardNum += randomValue[k] + ',';
            k++;
            t++;
          }
          socketIDandCardNum += ',';
        }
        arrData = socketIDandCardNum.split(',') //,을 기준으로 배열로 만들어줌


        //빈배열공간을 지워줌
        while (true) {
          if (arrData.indexOf('') < 0) {
            break;
          }
          arrData.splice(arrData.indexOf(''), 1);
        }


        console.log(arrData);


        reasonForRematch = "멍구사"; //재경기 이유


        io.sockets.emit('again message', {
          //user: socket.username + "패나누기",
          socketIDnCardnum: arrData, //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....
          randomValue: randomValue, //랜덤값 배열 넘기기
          reasonForRematch: reasonForRematch, //재경기 이유
          globalBettingV: globalBettingV //플레이어별 베팅금액 p1,bettingValue1,p2,bettingValue2....
        });



        dataForCall = 0;
        //바로 첫번째 콜 이벤트 발생으로 진행
        updateFirstButton('firstCall showSecondcard', data.starterLength, data.starterMemList);


        return; //함수탈툴


      } else {
        console.log('멍구사 작동ㄴㄴㄴㄴ');
        rnArr2[rnArr2.indexOf(12)] = 18; //멍텅구리 사구 조건에 안맞으면 3끗 넣어줌
      }









      //구사 처리   알리 이하 재경기-----------------
      if ((rnArr2.indexOf(11) >= 0) && (maxValueT <= 30)) {
        //재경기하는 코드 짜셈

        //알리이하면 재경기(다이멤버 제외)
        //재시합하는 코딩하면됨.  emit으로 보내서 다른 이벤트(재승부)를 발생시킴
        //여기서 재시합기준은 최대값을 가진사람들끼리 승부 다이멤버만 조절해주면됨


        checkCallPhase = 1;
        checkCall = 0;



        randomValue = []; //랜덤카드변수 초기화
        //중복없는 랜덤 번호 만들기
        for (var i = 0; i < (data.starterMemList.length) * 2; i++) {
          randomValue[i] = Math.floor(Math.random() * 19) + 1;

          //중복제거 확인용
          for (var j = 0; j < i; j++) {
            if (randomValue[i] === randomValue[j]) {
              i = i - 1;
              break;
            }
          }
        }
        console.log('randomValue~' + randomValue);





        //console.log('랜덤값' + randomValue);
        //console.log('--------------확인--------------');
        var socketIDandCardNum = '';

        var k = 0;
        //플레이어아뒤1,랜덤값1,랜덤값2,플레이어아뒤2,랜덤값3,랜덤값4,플레이어아뒤3,랜덤값5.....
        for (var i = 0; i < data.starterMemList.length; i++) {
          //console.log(socketId[i]);
          socketIDandCardNum += data.starterMemList[i] + ',';

          var t = 0;
          while (t < 2) {
            socketIDandCardNum += randomValue[k] + ',';
            k++;
            t++;
          }
          socketIDandCardNum += ',';
        }
        arrData = socketIDandCardNum.split(',') //,을 기준으로 배열로 만들어줌


        //빈배열공간을 지워줌
        while (true) {
          if (arrData.indexOf('') < 0) {
            break;
          }
          arrData.splice(arrData.indexOf(''), 1);
        }


        console.log(arrData);



        reasonForRematch = "구사";

        io.sockets.emit('again message', {
          //user: socket.username + "패나누기",
          socketIDnCardnum: arrData, //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....
          randomValue: randomValue, //랜덤값 배열 넘기기
          reasonForRematch: reasonForRematch,
          globalBettingV: globalBettingV //플레이어별 베팅금액 p1,bettingValue1,p2,bettingValue2....
        });

        //재경기 인덱스를 추가할 emit을 따로 작성하기
        dataForCall = 0;

        //바로 첫번째 콜 이벤트 발생으로 진행
        updateFirstButton('firstCall showSecondcard', data.starterLength, data.starterMemList);

        //console.log('재시합~'); //배열(유저게임수 만큼 존재


        //console.log('구사 작동함!!!!!!!!!!!!');


        return; //함수탈툴



      } else {
        rnArr2[rnArr2.indexOf(11)] = 18; //알리가조건에 안맞으면 3끗 넣어줌
        //console.log('구사 작동xxxxxxxxxxxxxxxxxxxxxxxx');

      }




      var dieMemIndex = []; //다이멤버의 인덱스를 찾아줌
      for (var i = 0; i < checkDieMemList.length; i++) {
        dieMemIndex[i] = data.starterMemList.indexOf(checkDieMemList[i]);
      }




      //찾은 다이멤버 인덱스를 찾아서 우선순위 인덱스를 수정(다이멤버가 존재시 해당 위치의 값을 -1로 지정)
      if (dieMemIndex.length >= 0) {
        for (var i = 0; i < data.starterLength; i++) {
          if (dieMemIndex.indexOf(i) >= 0) {
            rnArr2[i] = -1;
          }
        }
      }



      var maxValue = Math.max.apply(null, rnArr2); //최대값을찾는다 (승리자 찾음)



      var checkAgainPoint = -1; //재시합의 기준
      var maxValueIndexForOverlap = []; //승리자 중복시 인덱스를 저장(재경기를 위해서)
      for (var i = 0; i < rnArr2.length; i++) {
        if (rnArr2[i] === maxValue) { //최대값이 있을때마다 체크해줌
          checkAgainPoint += 1;
          maxValueIndexForOverlap.push(i); //중복되는 인덱스를 배열에 넣어줌
        }
      }









      //최고값승리자 중복시 재경시 시작!!!!!!!!!!!!!!!--- 아닐시 게임섻----------------------------------
      if (checkAgainPoint >= 1) { //최대값을 가지지 못한사람은 다 다이멤버로 포함시켜서 처리한다.
        //재시합하는 코딩하면됨.  emit으로 보내서 다른 이벤트(재승부)를 발생시킴
        //여기서 재시합기준은 최대값을 가진사람들끼리 승부 다이멤버만 조절해주면됨

        //console.log('재경기 작동함');


        checkCallPhase = 1;
        checkCall = 0;
        checkDieMemList = []; //다이멤버 초기화



        //maxValueIndexForOverlap에 중복안되는 인덱스는 다 다이멤버로 넣어줌
        for (var i = 0; i < data.starterMemList.length; i++) {
          if (maxValueIndexForOverlap.indexOf(i) >= 0) {
            continue;
          } else {
            checkDieMemList.push(data.starterMemList[i]);
          }
        }
        //console.log('다이 멤버좀 봅시다' + checkDieMemList);

        randomValue = []; //랜덤카드변수 초기화
        //중복없는 랜덤 번호 만들기
        for (var i = 0; i < (data.starterMemList.length) * 2; i++) {
          randomValue[i] = Math.floor(Math.random() * 19) + 1;

          //중복제거 확인용
          for (var j = 0; j < i; j++) {
            if (randomValue[i] === randomValue[j]) {
              i = i - 1;
              break;
            }
          }
        }
        console.log('randomValue~' + randomValue);





        //console.log('랜덤값' + randomValue);
        //console.log('--------------확인--------------');
        var socketIDandCardNum = '';

        var k = 0;
        //플레이어아뒤1,랜덤값1,랜덤값2,플레이어아뒤2,랜덤값3,랜덤값4,플레이어아뒤3,랜덤값5.....
        for (var i = 0; i < data.starterMemList.length; i++) {
          //console.log(socketId[i]);
          socketIDandCardNum += data.starterMemList[i] + ',';

          var t = 0;
          while (t < 2) {
            socketIDandCardNum += randomValue[k] + ',';
            k++;
            t++;
          }
          socketIDandCardNum += ',';
        }
        arrData = socketIDandCardNum.split(',') //,을 기준으로 배열로 만들어줌


        //빈배열공간을 지워줌
        while (true) {
          if (arrData.indexOf('') < 0) {
            break;
          }
          arrData.splice(arrData.indexOf(''), 1);
        }


        console.log(arrData);


        reasonForRematch = "무승부";


        io.sockets.emit('again message', {
          //user: socket.username + "패나누기",
          socketIDnCardnum: arrData, //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....
          randomValue: randomValue, //랜덤값 배열 넘기기
          reasonForRematch: reasonForRematch, //재경기 이유
          globalBettingV: globalBettingV //플레이어별 베팅금액 p1,bettingValue1,p2,bettingValue2....
        });



        dataForCall = 0;
        //바로 첫번째 콜 이벤트 발생으로 진행
        updateFirstButton('firstCall showSecondcard', data.starterLength, data.starterMemList);

        //console.log('재시합~'); //배열(유저게임수 만큼 존재
        return;


      } else { //end of 재시합`
        //----------------게임셋.----------------------------------
        var maxValueIndex = rnArr2.indexOf(maxValue); //최대값의 인덱스를 찾는다

        checkGameStart = 0;


        console.log('최고값 인덱스' + maxValueIndex); //최고 값 인덱스
        console.log('재시합기준값' + checkAgainPoint); //재시합의 기준값



        console.log(rnArr); //배열(유저게임수 만큼 존재
        console.log(rnArr2); //배열(유저게임수 만큼 존재

        var gameSetdata = [];


        //승리자 아이디 이걸가지고승리자만 따로이벤트하고 나머진 패배
        winner = data.starterMemList[maxValueIndex];


        // 여기서 개임셋할때 emit 정보 -- 보내기
        io.sockets.emit('secondCall gameset', {
          Turnmsg: arrFirstTurnButton, // 턴넘기기 버튼활성화인덱스 정보가 들어간 배열변수 유저아이디,인덱스,유저아이디2,인덱스2...이런식
          usersLength: data.starterLength, //유저의 길이 넘겨줌
          socketIDList: data.starterMemList, //유저 리스트 넘겨줌
          checkCall: checkCall, //콜버튼 스택확인용
          bettingValue: bettingValue, //베팅 금액  아직 지정안됨
          checkDieMemList: checkDieMemList, //다이멤버 리스트
          dataForCall: dataForCall, //call을 위한 금액 저장
          rnArr: rnArr, //카드 결과 정보 문자
          winner: winner //최종 승리자 아이디
        });
        return;

      }

    } else if (checkCall + 1 >= ((data.starterLength) - checkDieMemList.length) && checkCallPhase === 0) {

      //-----------------첫째콜---------------

      checkCallPhase = 1;
      checkCall = 0;
      if (((data.starterLength) - checkDieMemList.length) <= 1) { //유저의 길이-다이멤버수 = 1이하일경우 바로 게임셋
        console.log('게임셋하는 코드');
      }


      console.log('예외 적용용 확인: 길이 - 다이멤: 결과' + data.starterLength + '-' + checkDieMemList.length + '=' + ((data.starterLength) - checkDieMemList.length));
      console.log('die button에서 실행됨 checkcall값&phase' + checkCall + ':phase::' + checkCallPhase);
      dataForCall = 0;

      updateFirstButton('firstCall showSecondcard', data.starterLength, data.starterMemList);

      return;





      //--------------두번째 콜 이벤트 발생시 게임셋----------------------------------------------
    } else if (checkCall >= ((data.starterLength - 1) - checkDieMemList.length) && checkCallPhase === 1) {


      var rnArr = [];
      var rnArr2 = [];
      var k = 0;


      for (var i = 0; i < data.starterLength; i++) {
        //값1                값2
        var tempCon = null;
        tempCon = randomValue[k] + randomValue[k + 1];

        if ((randomValue[k] === 3 && randomValue[k + 1] === 8) ||
          (randomValue[k] === 8 && randomValue[k + 1] === 3)) {
          rnArr[i] = "38광땡";
          rnArr2[i] = 45;
        } else if ((randomValue[k] === 1 && randomValue[k + 1] === 8) ||
          (randomValue[k] === 8 && randomValue[k + 1] === 1)) {
          rnArr[i] = "18광땡";
          rnArr2[i] = 43;
        } else if ((randomValue[k] === 1 && randomValue[k + 1] === 3) ||
          (randomValue[k] === 3 && randomValue[k + 1] === 1)) {
          rnArr[i] = "13광땡";
          rnArr2[i] = 42;
        } else if ((randomValue[k] % 10 === randomValue[k + 1] % 10)) {


          if (((randomValue[k] + randomValue[k + 1]) % 10) === 0) {
            rnArr[i] = "장땡";
            rnArr2[i] = 41;
          } else {
            rnArr[i] = String(randomValue[k] % 10) + "땡";
            rnArr2[i] = randomValue[k] % 10 + 30; //39:9땡 ~ 31:1땡
          }

        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 2) ||
          (randomValue[k] % 10 === 2 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "알리";
          rnArr2[i] = 30;
        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 4) ||
          (randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "독사";
          rnArr2[i] = 29;
        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 9) ||
          (randomValue[k] % 10 === 9 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "구삥";
          rnArr2[i] = 28;
        } else if ((randomValue[k] % 10 === 1 && randomValue[k + 1] % 10 === 0) ||
          (randomValue[k] % 10 === 0 && randomValue[k + 1] % 10 === 1)) {
          rnArr[i] = "장삥";
          rnArr2[i] = 27;
        } else if ((randomValue[k] % 10 === 0 && randomValue[k + 1] % 10 === 4) ||
          (randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 0)) {
          rnArr[i] = "장사";
          rnArr2[i] = 26;
        } else if ((randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 6) ||
          (randomValue[k] % 10 === 6 && randomValue[k + 1] % 10 === 4)) {
          rnArr[i] = "세륙";
          rnArr2[i] = 25;
        } else if ((randomValue[k] + randomValue[k + 1]) % 10 === 9) {
          rnArr[i] = "갑오";
          rnArr2[i] = 24;
        } else if ((randomValue[k] === 4 && randomValue[k + 1] === 7) ||
          (randomValue[k] === 7 && randomValue[k + 1] === 4)) {
          rnArr[i] = "47암행어사";
          rnArr2[i] = 14;
        } else if ((randomValue[k] === 3 && randomValue[k + 1] === 7) ||
          (randomValue[k] === 7 && randomValue[k + 1] === 3)) {
          rnArr[i] = "땡잡이";
          rnArr2[i] = 13;
        } else if ((randomValue[k] === 4 && randomValue[k + 1] === 19) ||
          (randomValue[k] === 19 && randomValue[k + 1] === 4)) {
          rnArr[i] = "멍텅구리 구사";
          rnArr2[i] = 12;
        } else if ((randomValue[k] % 10 === 4 && randomValue[k + 1] % 10 === 9) ||
          (randomValue[k] % 10 === 9 && randomValue[k + 1] % 10 === 4)) {
          rnArr[i] = "구사";
          rnArr2[i] = 11;
        } else if (((randomValue[k] + randomValue[k + 1]) % 10 === 8) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 7) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 6) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 5) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 4) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 3) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 2) ||
          ((randomValue[k] + randomValue[k + 1]) % 10 === 1)) {
          rnArr[i] = String((randomValue[k] + randomValue[k + 1]) % 10) + "끗";
          rnArr2[i] = (((randomValue[k] + randomValue[k + 1]) % 10) + 15); //23 8끗 기준
        } else if ((randomValue[k] + randomValue[k + 1]) % 10 === 0) {
          rnArr[i] = "망통";
          rnArr2[i] = 15;
        }

        //체크포인트
        k += 2;
      }



      //암행어사 처리
      if ((rnArr2.indexOf(14) >= 0) &&
        ((rnArr2.indexOf(43) >= 0) ||
          (rnArr2.indexOf(42) >= 0)
        )) {
        rnArr2[rnArr2.indexOf(14)] = 44; //13,18보다 위로 격상
      } else {
        rnArr2[rnArr2.indexOf(14)] = 16; //조건에 안맞으면 1끗 넣어줌
      }





      //땡잡이처리
      if ((rnArr2.indexOf(13) >= 0) &&
        ((rnArr2.indexOf(39) >= 0) ||
          (rnArr2.indexOf(38) >= 0) ||
          (rnArr2.indexOf(37) >= 0) ||
          (rnArr2.indexOf(35) >= 0) ||
          (rnArr2.indexOf(34) >= 0) ||
          (rnArr2.indexOf(33) >= 0) ||
          (rnArr2.indexOf(36) >= 0) ||
          (rnArr2.indexOf(32) >= 0) ||
          (rnArr2.indexOf(31) >= 0)
        )) {
        rnArr2[rnArr2.indexOf(13)] = 40; // 1~9땡보다 위로 격상
      } else {
        rnArr2[rnArr2.indexOf(13)] = 15; //조건에 안맞으면 망통에 넣어줌
      }





      //최대값을찾는다 (멍사구,사구 조건처리용)
      var maxValueT = Math.max.apply(null, rnArr2);





      //멍텅구리 사구 처리   장땡이하 재경기  다이멤머를 제외한 전부 재경기
      if ((rnArr2.indexOf(12) >= 0) &&
        (maxValueT <= 41)) {
        //재경기 하는 코드 짜셈

        console.log('멍사구 작동');


        checkCallPhase = 1;
        checkCall = 0;



        randomValue = []; //랜덤카드변수 초기화
        //중복없는 랜덤 번호 만들기
        for (var i = 0; i < (data.starterMemList.length) * 2; i++) {
          randomValue[i] = Math.floor(Math.random() * 19) + 1;

          //중복제거 확인용
          for (var j = 0; j < i; j++) {
            if (randomValue[i] === randomValue[j]) {
              i = i - 1;
              break;
            }
          }
        }
        console.log('randomValue~' + randomValue);





        //console.log('랜덤값' + randomValue);
        //console.log('--------------확인--------------');
        var socketIDandCardNum = '';

        var k = 0;
        //플레이어아뒤1,랜덤값1,랜덤값2,플레이어아뒤2,랜덤값3,랜덤값4,플레이어아뒤3,랜덤값5.....
        for (var i = 0; i < data.starterMemList.length; i++) {
          //console.log(socketId[i]);
          socketIDandCardNum += data.starterMemList[i] + ',';

          var t = 0;
          while (t < 2) {
            socketIDandCardNum += randomValue[k] + ',';
            k++;
            t++;
          }
          socketIDandCardNum += ',';
        }
        arrData = socketIDandCardNum.split(',') //,을 기준으로 배열로 만들어줌


        //빈배열공간을 지워줌
        while (true) {
          if (arrData.indexOf('') < 0) {
            break;
          }
          arrData.splice(arrData.indexOf(''), 1);
        }


        console.log(arrData);


        reasonForRematch = "멍구사"; //재경기 이유


        io.sockets.emit('again message', {
          //user: socket.username + "패나누기",
          socketIDnCardnum: arrData, //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....
          randomValue: randomValue, //랜덤값 배열 넘기기
          reasonForRematch: reasonForRematch, //재경기 이유
          globalBettingV: globalBettingV //플레이어별 베팅금액 p1,bettingValue1,p2,bettingValue2....
        });



        dataForCall = 0;
        //바로 첫번째 콜 이벤트 발생으로 진행
        updateFirstButton('firstCall showSecondcard', data.starterLength, data.starterMemList);


        return; //함수탈툴


      } else {
        console.log('멍구사 작동ㄴㄴㄴㄴ');
        rnArr2[rnArr2.indexOf(12)] = 18; //멍텅구리 사구 조건에 안맞으면 3끗 넣어줌
      }









      //구사 처리   알리 이하 재경기-----------------
      if ((rnArr2.indexOf(11) >= 0) && (maxValueT <= 30)) {
        //재경기하는 코드 짜셈

        //알리이하면 재경기(다이멤버 제외)
        //재시합하는 코딩하면됨.  emit으로 보내서 다른 이벤트(재승부)를 발생시킴
        //여기서 재시합기준은 최대값을 가진사람들끼리 승부 다이멤버만 조절해주면됨


        checkCallPhase = 1;
        checkCall = 0;



        randomValue = []; //랜덤카드변수 초기화
        //중복없는 랜덤 번호 만들기
        for (var i = 0; i < (data.starterMemList.length) * 2; i++) {
          randomValue[i] = Math.floor(Math.random() * 19) + 1;

          //중복제거 확인용
          for (var j = 0; j < i; j++) {
            if (randomValue[i] === randomValue[j]) {
              i = i - 1;
              break;
            }
          }
        }
        console.log('randomValue~' + randomValue);





        //console.log('랜덤값' + randomValue);
        //console.log('--------------확인--------------');
        var socketIDandCardNum = '';

        var k = 0;
        //플레이어아뒤1,랜덤값1,랜덤값2,플레이어아뒤2,랜덤값3,랜덤값4,플레이어아뒤3,랜덤값5.....
        for (var i = 0; i < data.starterMemList.length; i++) {
          //console.log(socketId[i]);
          socketIDandCardNum += data.starterMemList[i] + ',';

          var t = 0;
          while (t < 2) {
            socketIDandCardNum += randomValue[k] + ',';
            k++;
            t++;
          }
          socketIDandCardNum += ',';
        }
        arrData = socketIDandCardNum.split(',') //,을 기준으로 배열로 만들어줌


        //빈배열공간을 지워줌
        while (true) {
          if (arrData.indexOf('') < 0) {
            break;
          }
          arrData.splice(arrData.indexOf(''), 1);
        }


        console.log(arrData);



        reasonForRematch = "구사";

        io.sockets.emit('again message', {
          //user: socket.username + "패나누기",
          socketIDnCardnum: arrData, //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....
          randomValue: randomValue, //랜덤값 배열 넘기기
          reasonForRematch: reasonForRematch,
          globalBettingV: globalBettingV //플레이어별 베팅금액 p1,bettingValue1,p2,bettingValue2....
        });

        //재경기 인덱스를 추가할 emit을 따로 작성하기

        dataForCall = 0;
        //바로 첫번째 콜 이벤트 발생으로 진행
        updateFirstButton('firstCall showSecondcard', data.starterLength, data.starterMemList);

        //console.log('재시합~'); //배열(유저게임수 만큼 존재


        //console.log('구사 작동함!!!!!!!!!!!!');


        return; //함수탈툴



      } else {
        rnArr2[rnArr2.indexOf(11)] = 18; //알리가조건에 안맞으면 3끗 넣어줌
        //console.log('구사 작동xxxxxxxxxxxxxxxxxxxxxxxx');

      }




      var dieMemIndex = []; //다이멤버의 인덱스를 찾아줌
      for (var i = 0; i < checkDieMemList.length; i++) {
        dieMemIndex[i] = data.starterMemList.indexOf(checkDieMemList[i]);
      }




      //찾은 다이멤버 인덱스를 찾아서 우선순위 인덱스를 수정(다이멤버가 존재시 해당 위치의 값을 -1로 지정)
      if (dieMemIndex.length >= 0) {
        for (var i = 0; i < data.starterLength; i++) {
          if (dieMemIndex.indexOf(i) >= 0) {
            rnArr2[i] = -1;
          }
        }
      }



      var maxValue = Math.max.apply(null, rnArr2); //최대값을찾는다 (승리자 찾음)



      var checkAgainPoint = -1; //재시합의 기준
      var maxValueIndexForOverlap = []; //승리자 중복시 인덱스를 저장(재경기를 위해서)
      for (var i = 0; i < rnArr2.length; i++) {
        if (rnArr2[i] === maxValue) { //최대값이 있을때마다 체크해줌
          checkAgainPoint += 1;
          maxValueIndexForOverlap.push(i); //중복되는 인덱스를 배열에 넣어줌
        }
      }









      //최고값승리자 중복시 재경시 시작!!!!!!!!!!!!!!!--- 아닐시 게임섻----------------------------------
      if (checkAgainPoint >= 1) { //최대값을 가지지 못한사람은 다 다이멤버로 포함시켜서 처리한다.
        //재시합하는 코딩하면됨.  emit으로 보내서 다른 이벤트(재승부)를 발생시킴
        //여기서 재시합기준은 최대값을 가진사람들끼리 승부 다이멤버만 조절해주면됨

        //console.log('재경기 작동함');


        checkCallPhase = 1;
        checkCall = 0;
        checkDieMemList = []; //다이멤버 초기화



        //maxValueIndexForOverlap에 중복안되는 인덱스는 다 다이멤버로 넣어줌
        for (var i = 0; i < data.starterMemList.length; i++) {
          if (maxValueIndexForOverlap.indexOf(i) >= 0) {
            continue;
          } else {
            checkDieMemList.push(data.starterMemList[i]);
          }
        }
        //console.log('다이 멤버좀 봅시다' + checkDieMemList);

        randomValue = []; //랜덤카드변수 초기화
        //중복없는 랜덤 번호 만들기
        for (var i = 0; i < (data.starterMemList.length) * 2; i++) {
          randomValue[i] = Math.floor(Math.random() * 19) + 1;

          //중복제거 확인용
          for (var j = 0; j < i; j++) {
            if (randomValue[i] === randomValue[j]) {
              i = i - 1;
              break;
            }
          }
        }
        console.log('randomValue~' + randomValue);





        //console.log('랜덤값' + randomValue);
        //console.log('--------------확인--------------');
        var socketIDandCardNum = '';

        var k = 0;
        //플레이어아뒤1,랜덤값1,랜덤값2,플레이어아뒤2,랜덤값3,랜덤값4,플레이어아뒤3,랜덤값5.....
        for (var i = 0; i < data.starterMemList.length; i++) {
          //console.log(socketId[i]);
          socketIDandCardNum += data.starterMemList[i] + ',';

          var t = 0;
          while (t < 2) {
            socketIDandCardNum += randomValue[k] + ',';
            k++;
            t++;
          }
          socketIDandCardNum += ',';
        }
        arrData = socketIDandCardNum.split(',') //,을 기준으로 배열로 만들어줌


        //빈배열공간을 지워줌
        while (true) {
          if (arrData.indexOf('') < 0) {
            break;
          }
          arrData.splice(arrData.indexOf(''), 1);
        }


        console.log(arrData);


        reasonForRematch = "무승부";


        io.sockets.emit('again message', {
          //user: socket.username + "패나누기",
          socketIDnCardnum: arrData, //소켓아이디1,카드번호1,카드번호2,소켓아이디2,카드번호1,카드번호2....
          randomValue: randomValue, //랜덤값 배열 넘기기
          reasonForRematch: reasonForRematch, //재경기 이유
          globalBettingV: globalBettingV //플레이어별 베팅금액 p1,bettingValue1,p2,bettingValue2....
        });



        dataForCall = 0;
        //바로 첫번째 콜 이벤트 발생으로 진행
        updateFirstButton('firstCall showSecondcard', data.starterLength, data.starterMemList);

        //console.log('재시합~'); //배열(유저게임수 만큼 존재
        return;


      } else { //end of 재시합`
        var maxValueIndex = rnArr2.indexOf(maxValue); //최대값의 인덱스를 찾는다


        console.log('최고값 인덱스' + maxValueIndex); //최고 값 인덱스
        console.log('재시합기준값' + checkAgainPoint); //재시합의 기준값



        console.log(rnArr); //배열(유저게임수 만큼 존재
        console.log(rnArr2); //배열(유저게임수 만큼 존재

        var gameSetdata = [];


        //승리자 아이디 이걸가지고승리자만 따로이벤트하고 나머진 패배
        winner = data.starterMemList[maxValueIndex];


        //bettingValue
        //winner

        gameSetAmount = globalBettingV;

        console.log('승리자!!');


        // 여기서 개임셋할때 emit 정보 -- 보내기
        io.sockets.emit('secondCall gameset', {
          Turnmsg: arrFirstTurnButton, // 턴넘기기 버튼활성화인덱스 정보가 들어간 배열변수 유저아이디,인덱스,유저아이디2,인덱스2...이런식
          usersLength: data.starterLength, //유저의 길이 넘겨줌
          socketIDList: data.starterMemList, //유저 리스트 넘겨줌
          checkCall: checkCall, //콜버튼 스택확인용
          bettingValue: bettingValue, //베팅 금액  아직 지정안됨
          checkDieMemList: checkDieMemList, //다이멤버 리스트
          dataForCall: dataForCall, //call을 위한 금액 저장
          rnArr: rnArr, //카드 결과 정보 문자
          winner: winner //최종 승리자 아이디
        });
        return;

      }

    } else {
      updateFirstButton('firstTurn button', data.starterLength, data.starterMemList);
    }





    //firstRutnButton emit


  }); //본격적인 다이 버튼 컨트롤----------end------------------









  //------------------------------------------------------------------------------




  //본격적인 턴넘기기 버튼 ----------start   --클라이언트에서 값 받음
  socket.on('turn button', function(data) { //send message를 키값으로지정하고 콜백으로 data





    //console.log('다음턴을 지정하기위한 유저의 이름(기준)'+data.socketIdC);


    //socketid리스트중에서 data의 위치를 찾아내 반환해라 (0부터시작임)
    //-------순서지정하기위해 플레이어 에게 각각 다른 정보를 보내야함
    gameStartUserindex = socketId.indexOf(data.socketIdC); //---------------인덱스 이거랑
    //console.log('게임 시작한 유저의 인덱스::::'+gameStartUserindex);


    //게임시작했던 유저의 인원정보--------
    //console.log('유저의 인원수'+data.starterLength);  //--------------------총 유저의수 이거랑



    console.log('넘겨받은소켓ID리스트:::' + data.starterMemList); //--------------------소켓아뒤 리스트 이거랑 ㅇㅇ


    gameStartUserindex++; //다음 유저에게 순서를 줘야하기때문에 1 2

    //하지만 인덱스가 총유저의 수보다 커버리거나 같다면

    if (data.starterLength <= gameStartUserindex) {
      gameStartUserindex = 0; //순서 첫번째로 돌려야하기때문에
    }


    var socketId_for_Firstbutton = '';

    for (var i = 0; i < data.starterLength; i++) {
      socketId_for_Firstbutton += data.starterMemList[i];
      socketId_for_Firstbutton += ',';

      if (gameStartUserindex === i) {
        socketId_for_Firstbutton += 'show';
      } else {
        socketId_for_Firstbutton += 'hidden';
      }
      socketId_for_Firstbutton += ',';
    }


    arrFirstTurnButton = socketId_for_Firstbutton.split(',') //,을 기준으로 배열로 만들어줌

    //빈공간 배열""이 생겨서 지워줌
    arrFirstTurnButton.splice(arrFirstTurnButton.indexOf(""), 1);


    //firstRutnButton emit
    updateFirstButton('firstTurn button', data.starterLength, data.starterMemList);



  }); //본격적인 턴 버튼 컨트롤----------end------------------









  //----------------------------------유저데이터관련--------------
  //New User 받는거!!! ---클라이언트에서 보낸 데이터 받음
  socket.on('new user', function(data, callback) {
    callback(true);
    socket.username = data; //데이터를 socket.username에 넣어준다.
    users.push(socket.username); //user 배열에 socket.username을 추가
    updateUsernames(); //변경된 유저정보를 클라이언트쪽에 다뿌려줌
  });




  function updateUsernames() { //보내는거!!!!유저정보를 client쪽으로 뿌림
    io.sockets.emit('get users', {
      users: users,
      checkGameStart: checkGameStart
    });
  }






  //updateFirstButton
  function updateFirstButton(targetname, starterLength, starterMemList) { //보내는거!!!!유저정보를 client쪽으로 뿌림

    io.sockets.emit(targetname, {
      Turnmsg: arrFirstTurnButton, // 턴넘기기 버튼활성화인덱스 정보가 들어간 배열변수 유저아이디,인덱스,유저아이디2,인덱스2...이런식
      usersLength: starterLength, //유저의 길이 넘겨줌
      socketIDList: starterMemList, //유저 리스트 넘겨줌
      checkCall: checkCall, //콜버튼 스택확인용
      bettingValue: bettingValue, //베팅 금액  아직 지정안됨
      checkDieMemList: checkDieMemList, //다이멤버 리스트
      dataForCall: dataForCall //call을 위한 금액 저장
    });
  }




});

http.listen(port, function() {
  console.log('listening on *:' + port);
});
