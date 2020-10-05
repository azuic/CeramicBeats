const colors={'fritware':  "#6374bf",
    'other/unspecified': "#af9278",
    'terracotta': "#d17538",
    'ceramic': "#fae6cf",
    'pottery': "#a3b39d",
    'earthenware': "#dd9c85",
    'stoneware': "#D9D0C8",
    'clay': "#ccb21f",
    'porcelain': "#abbfe0"};

const steps = 16;
const noteNames = Object.keys(alltypes);
// const objList = noteNames.map(each=>_.sampleSize(alltypes[each],16));
const objList = noteNames.map(each=>alltypes[each].slice(48,64));


let controlPanel = document.querySelector("div.controls");
// control cells
for (let k=0; k<9; k++){
    let control = document.createElement("div");
    control.setAttribute("class","control-cell");
    control.setAttribute("id",noteNames[k]);
    let countControl = document.createElement("div");
    countControl.setAttribute("class","control-count");
    countControl.style.color = colors[noteNames[k]];
    let typeSelected = document.getElementsByClassName(`beatCell ${noteNames[k]} selected`)
    countControl.textContent = typeSelected.length;
    control.appendChild(countControl);
    let countTitle = document.createElement("div");
    countTitle.setAttribute("class","control-title");
    // countTitle.style.borderBottom = `${colors[noteNames[k]]} solid 2px`;
    let titleContent = document.createElement("span");
    titleContent.style.borderBottom = `${colors[noteNames[k]]} solid 2px`;
    titleContent.style.paddingBottom = "2px";
    titleContent.textContent = noteNames[k].toUpperCase();
    countTitle.appendChild(titleContent);
    control.appendChild(countTitle);
    controlPanel.appendChild(control);
}

let playControl = document.createElement("div");
playControl.setAttribute("class","control-cell");
let playButton = document.createElement("button");
playButton.setAttribute("class","play-button");
playControl.appendChild(playButton);
let playHint = document.createElement("div");
playHint.setAttribute("class","control-title");
playHint.textContent = "PLAY";
// playHint.style.textAlign="left"
playControl.appendChild(playHint);
controlPanel.appendChild(playControl);




// drum cells
let cellPad = document.querySelector("div.cell-pad");
// console.log(cellPad)
for (let i=0; i<steps;i++){
    let step = document.createElement("div");
    step.setAttribute("class","beatStep");
    for (let j=0; j<9; j++){
        let cell = document.createElement("div");
        cell.setAttribute("class","beatCell");
        cell.classList.add(noteNames[j])
        cell.addEventListener("click",function (e) {
            let selectedCell = e.target;
            if (selectedCell.classList.contains("selected")){
                selectedCell.classList.remove("selected");
            }else{
                selectedCell.classList.add("selected");
            }
            let typeSelected = document.getElementsByClassName(`beatCell ${noteNames[j]} selected`);
            let currentCountDiv = document.getElementById(noteNames[j])
            currentCountDiv.childNodes[0].textContent = typeSelected.length;
        })
        cell.style.backgroundImage=`url(https://d1tutlfztia4ba.cloudfront.net/resize-center/${objList[j][i]}.png)`
        step.appendChild(cell);
    }
    cellPad.appendChild(step);
}


let soundLinks ={};
for (let each of noteNames) {
    if (each!=="other/unspecified"){
        soundLinks[each]=`./CeramicBeats/sounds/${each}.wav`;
    } else {
        soundLinks[each]=`./CeramicBeats/sounds/other.wav`;
    }
}

let keys = new Tone.Players(
    {'fritware': "https://d1tutlfztia4ba.cloudfront.net/sounds/fritware.wav",
    'other/unspecified': "https://d1tutlfztia4ba.cloudfront.net/sounds/other.wav",
    'terracotta': "https://d1tutlfztia4ba.cloudfront.net/sounds/terracotta.wav",
    'ceramic': "https://d1tutlfztia4ba.cloudfront.net/sounds/ceramic.wav",
    'pottery': "https://d1tutlfztia4ba.cloudfront.net/sounds/pottery.wav",
    'earthenware': "https://d1tutlfztia4ba.cloudfront.net/sounds/earthenware.wav",
    'stoneware': "https://d1tutlfztia4ba.cloudfront.net/sounds/stoneware.wav",
    'clay': "https://d1tutlfztia4ba.cloudfront.net/sounds/clay.wav",
    'porcelain': "https://d1tutlfztia4ba.cloudfront.net/sounds/porcelain.wav"},
    {"volume":-10,"fadeOut":"64n",}).toMaster();
let loop = new Tone.Sequence(function(time, col){
    let currentStep = document.querySelectorAll("div.beatStep")[col];
    let currentCells = currentStep.children;
    for (let index=0; index<currentCells.length; index++){
      if (currentCells[index].classList.contains("selected")){
        var vel = Math.random() * 0.5 + 0.5;
        keys.get(noteNames[index]).start(time, 0, "32n", 0, vel);
      }
    }


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

// let controlPanel = document.querySelector("div.controls");
// let playButton = document.querySelector("button.play-button");
playButton.addEventListener('click',function () {
    Tone.start();
    if (!playing){

        Tone.Transport.start();
        playing = true;
        playButton.style.backgroundImage=`url("pause.png")`;
        playHint.textContent="PAUSE";
    } else {
        Tone.Transport.stop();
        playButton.style.backgroundImage=`url("play.png")`;
        playing = false;
        playHint.textContent="PLAY";
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
