
const steps = 16;
const noteNames = Object.keys(alltypes);
console.log(noteNames);
const objList = noteNames.map(each=>_.sampleSize(alltypes[each],16));
console.log(objList)
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

let soundLinks = {};
for (let each of noteNames) {
    if (each!=="other/unspecified"){
        soundLinks[each]=`./CeramicBeats/sounds/${each}.wav`;
    } else {
        soundLinks[each]=`./CeramicBeats/sounds/other.wav`;
    }
}
// sounds/ceramic.wav

let keys = new Tone.Players(soundLinks,{"volume":-10,"fadeOut":"64n",}).toDestination();
let loop = new Tone.Sequence(function(time, col){
    let currentStep = document.querySelectorAll("div.beatStep")[col];

    currentStep.forEach(function(val, i){
        if (val){
            //slightly randomized velocities
            var vel = Math.random() * 0.5 + 0.5;
            keys.get(noteNames[i]).start(time, 0, "32n", 0, vel);
        }
    });
    //set the columne on the correct draw frame
    Tone.Draw.schedule(function(){
        currentStep.classList.add("currentStep");
    }, time);
});

loop.start();
let playing=false;

let controlPanel = document.getElementById("controls");
// controlPanel.bind(Tone.Transport);
let playButton = document.getElementById("play-button");
// Tone.Transport.toggle()
playButton.addEventListener('click',function () {
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


// Tone.Transport.on("stop", () => {
//     setTimeout(() => {
//         document.querySelectorAll("div.beatStep").classList.remove("currentStep");
//     }, 100);
// });

