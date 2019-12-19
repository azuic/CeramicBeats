
const steps = 16;
const noteNames = Object.keys(alltypes);
// console.log(noteNames);
const objList = noteNames.map(each=>_.sampleSize(alltypes[each],16));
// console.log(objList)
let cellPad = document.getElementById("cell-pad");

for (let i=0; i<steps;i++){
    let step = document.createElement("div");
    step.setAttribute("class","beatStep");
    // console.log(i);
    for (let j=0; j<9; j++){
        let cell = document.createElement("div");
        cell.setAttribute("class","beatCell");
        cell.addEventListener("click",function (e) {
            let selectedCell = e.target;
            if (selectedCell.classList.contains("selected")){
                selectedCell.classList.remove("selected");
            }else{
                selectedCell.classList.add("selected");
            }
        })
        // console.log(objList[j][i])
        cell.style.backgroundImage=`url(https://d1tutlfztia4ba.cloudfront.net/resize-center/${objList[j][i]}.png)`
        step.appendChild(cell);
    }
    cellPad.appendChild(step);
}

// let soundLinks = {'fritware': "https://d1tutlfztia4ba.cloudfront.net/sounds/fritware.wav",
//     'other/unspecified': "https://d1tutlfztia4ba.cloudfront.net/sounds/other.wav",
//     'terracotta': "https://d1tutlfztia4ba.cloudfront.net/sounds/terracotta.wav",
//     'ceramic': "https://d1tutlfztia4ba.cloudfront.net/sounds/ceramic.wav",
//     'pottery': "https://d1tutlfztia4ba.cloudfront.net/sounds/pottery.wav",
//     'earthenware': "https://d1tutlfztia4ba.cloudfront.net/sounds/earthenware.wav",
//     'stoneware': "https://d1tutlfztia4ba.cloudfront.net/sounds/stoneware.wav",
//     'clay': "https://d1tutlfztia4ba.cloudfront.net/sounds/clay.wav",
//     'porcelain': "https://d1tutlfztia4ba.cloudfront.net/sounds/porcelain.wav"};

// let soundLinks = {'fritware': "./sounds/fritware.wav",
//     'other/unspecified': "./sounds/other.wav",
//     'terracotta': "./sounds/ceramic.wav",
//     'pottery': "./sounds/pottery.wav",
//     'earthenware': "./sounds/earthenware.wav",
//     'stoneware': "./sounds/stoneware.wav",
//     'clay': "./sounds/clay.wav",
//     'porcelain': "./sounds/porcelain.wav"};

let soundLinks ={};
for (let each of noteNames) {
    if (each!=="other/unspecified"){
        soundLinks[each]=`./CeramicBeats/sounds/${each}.wav`;
    } else {
        soundLinks[each]=`./CeramicBeats/sounds/other.wav`;
    }
}
// sounds/ceramic.wav
// console.log(document.querySelectorAll("div.beatStep")[0]);
let keys = new Tone.Players(
    {'fritware': "./sounds/fritware.wav",
    'other/unspecified': "./sounds/other.wav",
    'terracotta': "./sounds/ceramic.wav",
    'pottery': "./sounds/pottery.wav",
    'earthenware': "./sounds/earthenware.wav",
    'stoneware': "./sounds/stoneware.wav",
    'clay': "./sounds/clay.wav",
    'porcelain': "./sounds/porcelain.wav"},
    {"volume":-10,"fadeOut":"64n",}).toMaster();
let loop = new Tone.Sequence(function(time, col){
    // console.log('here');
    let currentStep = document.querySelectorAll("div.beatStep")[col];
    // console.log(currentStep);
    Array.prototype.forEach.call(currentStep,function(item, index){
        if (item.classList.contains("selected")){
            //slightly randomized velocities
            var vel = Math.random() * 0.5 + 0.5;
            keys.load(noteNames[index]).start(time, 0, "32n", 0, vel);
            console.log(keys.get(noteNames[index]));
        }
    });

    let prevStep;
    if (col!==0){
        prevStep = document.querySelectorAll("div.beatStep")[col-1];
    } else {
        prevStep = document.querySelectorAll("div.beatStep")[15];
    }
    //set the columne on the correct draw frame
    Tone.Draw.schedule(function(){

        currentStep.classList.add("currentStep");
        if (prevStep.classList.contains("currentStep")){
            prevStep.classList.remove("currentStep");
        }
    }, time);
}, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], "16n");
loop.start(0);


let playing=false;

let controlPanel = document.getElementById("controls");
// controlPanel.bind(Tone.Transport);
let playButton = document.getElementById("play-button");
// Tone.Transport.toggle()
playButton.addEventListener('click',function () {
    Tone.start();
    if (!playing){

        Tone.Transport.start();
        playing = true;
        playButton.style.backgroundImage=`url("pause.png")`;
    } else {
        Tone.Transport.stop();
        playButton.style.backgroundImage=`url("play.png")`;
        playing = false;
    }
});


Tone.Transport.on("stop", () => {
    setTimeout(() => {
        let allsteps = document.querySelectorAll("div.beatStep");
        allsteps.forEach(each=> {
            if (each.classList.contains("currentStep")){
                each.classList.remove("currentStep")
            }
            });
    }, 100);
});

