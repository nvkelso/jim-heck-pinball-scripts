/*
  SegmentToSandbox.jsx
  A Javascript for Adobe Illustrator

  Author:
  Jim Heck
  jsurf@heckheck.com

  Purpose:
  A script to clone a path segments from open or closed paths based on 
  selected points to a Layer named 'Sandbox'.  If a path segment has only one
  selected point, the entire path segment is copied.  If the path segment
  has two selected points, the part of the path copied for an open path, is
  that part inclusive of the two selected points.  For a closed path, a dialog
  will be presented that allows the user to choose from four directions, top,
  bottom, left and right, which will indicate where part of the path lies that
  should NOT be copied.  The part of the path not containing this extremum will
  be copied to the 'Sandbox' layer.  The user will be given the opportunity to
  have the 'Sandbox' layer created if it does not exist.  The goal is to make
  it easy to copy part of a path to the 'Sandbox' layer for further manipulation.

  To Use:
  Select one or two points, or along a path (open or closed) and then run the
  script.

  Rights:
  This work is licensed under the Creative Commons Attribution 3.0 United States
  License. To view a copy of this license, visit
  http://creativecommons.org/licenses/by/3.0/us/
  or send a letter to Creative Commons, 171 Second Street, Suite 300,
  San Francisco, California, 94105, USA.

  Version History:
  1.4  110209 Replace spelling of 'SandBox' with 'Sandbox'
  1.3  091013 Add more choices for point inclusion/exclusion
  1.2  090911 Add code to copy entire path segment if only one point is
       selected
  1.1  090528 Bug fixes
  1.0  090402 Initial release
*/

/*******************************************************************************
 * Function: findHighestPathPoint
 * Description:
 *   Given a path, find the point with the most positive Y coordinate.  Return
 *   the index of that point.
 */
function findHighestPathPoint(path){
        var index = 0;
        var i = 0;

        for (i=0; i<path.pathPoints.length; i++) {
                if (path.pathPoints[i].anchor[1] > path.pathPoints[index].anchor[1]) {
                        index = i;
                }
        }
        return index;
}

/*******************************************************************************
 * Function: findLowestPathPoint
 * Description:
 *   Given a path, find the point with the most negative Y coordinate.  Return
 *   the index of that point.
 */
function findLowestPathPoint(path){
        var index = 0;
        var i = 0;

        for (i=0; i<path.pathPoints.length; i++) {
                if (path.pathPoints[i].anchor[1] < path.pathPoints[index].anchor[1]) {
                        index = i;
                }
        }
        return index;
}

/*******************************************************************************
 * Function: findRightmostPathPoint
 * Description:
 *   Given a path, find the point with the most positive X coordinate.  Return
 *   the index of that point.
 */
function findRightmostPathPoint(path){
        var index = 0;
        var i = 0;

        for (i=0; i<path.pathPoints.length; i++) {
                if (path.pathPoints[i].anchor[0] > path.pathPoints[index].anchor[0]) {
                        index = i;
                }
        }
        return index;
}

/*******************************************************************************
 * Function: findLeftmostPathPoint
 * Description:
 *   Given a path, find the point with the most negative X coordinate.  Return
 *   the index of that point.
 */
function findLeftmostPathPoint(path){
        var index = 0;
        var i = 0;

        for (i=0; i<path.pathPoints.length; i++) {
                if (path.pathPoints[i].anchor[0] < path.pathPoints[index].anchor[0]) {
                        index = i;
                }
        }
        return index;
}

/*******************************************************************************
 * Function: countSelectedPathPoints
 * Description:
 *   Given a path, count the number of selected anchor points.  Return the count.
 */
function countSelectedPathPoints(path){
        var i = 0;
        var count = 0;

        for (i=0; i<path.pathPoints.length; i++) {
                if (path.pathPoints[i].selected == PathPointSelection.ANCHORPOINT) {
                        count++
                }
        }
        return count;
}

/*******************************************************************************
 * Function: clonePointToPath
 * Description:
 *   Given a point and a path, append a new point to the path using values
 *   cloned from the point passed in.  Return the point created.
 */
function clonePointToPath(point, path){
        var clonedPoint;

        clonedPoint = path.pathPoints.add();
        clonedPoint.anchor = point.anchor;
        clonedPoint.leftDirection = point.leftDirection;
        clonedPoint.rightDirection = point.rightDirection;
        clonedPoint.pointType = point.pointType;
        return clonedPoint;
}

/*******************************************************************************
 * Function: getPathSegmentLength
 * Description:
 *   Given a path and two path point indicies, determine the length of the path
 *   segment connecting them.  Return the length of the segment, or -1 on error.
 */
function getPathSegmentLength(path, startIndex, endIndex){
        var tempLayer = app.activeDocument.layers.add();
        var tempPath;
        var tempPathPoint;
        var i;
        var length;

        tempLayer.name = "Temp";
        tempPath = tempLayer.pathItems.add();

        if (startIndex >= path.pathPoints.length || endIndex >= path.pathPoints.length) {
                tempPath.remove();
                return -1;
        }

        if (endIndex >= startIndex) {
                for (i=startIndex; i<=endIndex; i++) {
                        clonePointToPath(path.pathPoints[i], tempPath);
                }
        }
        else {
                if (!path.closed) {
                        tempPath.remove();
                        return -1;
                }
                for (i=startIndex; i<path.pathPoints.length; i++) {
                        clonePointToPath(path.pathPoints[i], tempPath);
                }
                for (i=0; i<=endIndex; i++) {
                        clonePointToPath(path.pathPoints[i], tempPath);
                }
        }

        length = tempPath.length;
        tempPath.remove();
        tempLayer.remove();

        return length;
}

/*******************************************************************************
 * Function: docGetSelectedPaths
 * Description:
 *   Get all the selected paths for the docRef argument passed in as
 *   a parameter.  The second parameter is a boolean that controls if compound
 *   path items are included (default true), and the third parameter is a
 *   boolean that controls if locked objects are included (default false).
 *   Returns an array of paths.
 */
function docGetSelectedPaths(docRef, includeCompound, includeLocked){
        var qualifiedPaths = new Array();
        var i = 0;
        var j = 0;
        var nextPath = null;
        var currentSelection = new Array();
        var nextSelection = docRef.selection;

        if (includeCompound == null) {
                includeCompound = true;
        }
        if (includeLocked == null) {
                includeLocked = false;
        }

        do {
                currentSelection = nextSelection;
                nextSelection = [];

                for(i=0; i<currentSelection.length; i++){
                        var currentObject=currentSelection[i];
                        if (currentObject.typename == "PathItem") {
                                if (includeLocked || !(currentObject.locked ||
                                                       currentObject.layer.locked)) {
                                        qualifiedPaths.push(currentObject);
                                }
                        }
                        else if (currentObject.typename == "CompoundPathItem") {
                                if (includeCompound &&
                                    (includeLocked || !(currentObject.locked ||
                                                        currentObject.layer.locked))) {
                                        /*
                                         * For more complex compound paths (e.g. concentric circular bands),
                                         * in CS3 the CompoundPathItem object's pathItems array is empty.
                                         * Inspection of the paths in a document shows the paths contained
                                         * in the CompoundPathItem have groups as parents. To get around
                                         * this seeming bug, in addition to using the pathItems array,
                                         * which still contains individual paths, we also search through
                                         * all the groups in the document adding paths whose parent
                                         * is the CompoundPathItem object.
                                         *
                                         * WARNING this takes non-negligible time in large documents.
                                         */
                                        for (j=0; j<currentObject.pathItems.length; j++) {
                                                qualifiedPaths.push(currentObject.pathItems[j]);
                                        }
                                        for (j=0; j<docRef.groupItems.length; j++) {
                                                if (docRef.groupItems[j].parent == currentObject) {
                                                        nextSelection.push(docRef.groupItems[j]);
                                                }
                                        }
                                }
                        }
                        else if (currentObject.typename == "GroupItem") {
                                for (j=0; j<currentObject.pathItems.length; j++){
                                        nextSelection.push(currentObject.pathItems[j]);
                                }
                                for (j=0; j<currentObject.compoundPathItems.length; j++){
                                        nextSelection.push(currentObject.compoundPathItems[j]);
                                }
                                for (j=0; j<currentObject.groupItems.length; j++){
                                        nextSelection.push(currentObject.groupItems[j]);
                                }
                        }
                        else if (currentObject.typename == "Layer") {
                                for (j=0; j<currentObject.pathItems.length; j++){
                                        nextSelection.push(currentObject.pathItems[j]);
                                }
                                for (j=0; j<currentObject.compoundPathItems.length; j++){
                                        nextSelection.push(currentObject.compoundPathItems[j]);
                                }
                                for (j=0; j<currentObject.groupItems.length; j++){
                                        nextSelection.push(currentObject.groupItems[j]);
                                }
                                for (j=0; j<currentObject.layers.length; j++){
                                        nextSelection.push(currentObject.layers[j]);
                                }
                        }
                }
        } while (nextSelection.length > 0);
        return qualifiedPaths;
}

/*******************************************************************************
/*******************************************************************************
/*******************************************************************************
* Main code
*/

var exitError = 0;

var docRef=app.activeDocument;
var sanBoxLayer;
var allSelectedPaths = new Array();
var onePointPathsToProcess = new Array();
var twoPointPathsToProcess = new Array();
var i = 0;
var j = 0;
var clonePointSet = new Array();
var count = 0;
var shorter = false;
var longer = false;
var includeTop = false;
var includeBottom = false;
var includeRight = false;
var includeLeft = false;
var excludeTop = false;
var excludeBottom = false;
var excludeRight = false;
var excludeLeft = false;
var sandboxNotVisible = false;
var referenceIndex;
var firstSelectedIndex;
var lastSelectedIndex;
var newPath;
var newPoint;
var newPathColor = new CMYKColor();
newPathColor.black = 0.0;
newPathColor.cyan = 0.0;
newPathColor.magenta = 100.0;
newPathColor.yellow = 100.0;

try {
        exitError = 99;

        /*
         * Find the Sandbox layer by name.
         */
        count = 0;
        for (i=0; i<docRef.layers.length; i++) {
                if (docRef.layers[i].name == "Sandbox") {
                        sandboxLayer = docRef.layers[i];
                        count++;
                }
        }

        if (count == 0) {
                var goOn = confirm("WARNING: No layer layer named 'Sandbox'.  Create one and continue?");
                exitError = 2;
                if (!goOn) {
                        exitError = 2;
                        throw("exit");
                }
                sandboxLayer = docRef.layers.add();
                sandboxLayer.name = "Sandbox";
                sandboxLayer.zOrder(ZOrderMethod.BRINGTOFRONT);
        }
        else if (count > 1) {
                var goOn = confirm("WARNING: More than one layer named 'Sandbox'.  Segment will be copied to one of them.  Continue?");
                if (!goOn) {
                        exitError = 3;
                        throw("exit");
                }
        }

        if (sandboxLayer.locked) {
                var goOn = confirm("WARNING: The 'Sandbox' layer is locked and will be unlocked.  Continue?");
                if (!goOn) {
                        exitError = 4;
                        throw("exit");
                }
                else {
                        sandboxLayer.locked = false;
                }
        }

        if (!sandboxLayer.visible) {
                sandboxNotVisible = true;
                sandboxLayer.visible = true;
        }

        allSelectedPaths = docGetSelectedPaths(docRef, true, false);
        if (allSelectedPaths.length == 0) {
                exitError = 5;
                throw("exit");
        }

        count = 0;
        for (i=0; i<allSelectedPaths.length; i++) {
                if (countSelectedPathPoints(allSelectedPaths[i]) == 1) {
                        onePointPathsToProcess.push(allSelectedPaths[i]);
                }
                else if (countSelectedPathPoints(allSelectedPaths[i]) == 2 && allSelectedPaths[i].pathPoints.length > 2) {
                        twoPointPathsToProcess.push(allSelectedPaths[i]);
                }
                else {
                        count++;
                }
        }
        if (count) {
                var goOn = confirm("WARNING: Some paths with selected points can not be processed, these will be skipped.  Continue?");
                if (!goOn) {
                        exitError = 6;
                        throw("exit");
                }
        }

        count = 0;
        for (i=0; i<twoPointPathsToProcess.length; i++) {
                if (twoPointPathsToProcess[i].closed) {
                        count++;
                }
        }

        if (count) {
                var dlgInit = new Window('dialog', 'Segment To Sandbox');
                doInitDialog(dlgInit);
                shorter = dlgInit.functionPnl.shorter.value;
                longer = dlgInit.functionPnl.longer.value;
                includeTop = dlgInit.functionPnl.includeTop.value;
                includeBottom = dlgInit.functionPnl.includeBottom.value;
                includeRight = dlgInit.functionPnl.includeRight.value;
                includeLeft = dlgInit.functionPnl.includeLeft.value;
                excludeTop = dlgInit.functionPnl.excludeTop.value;
                excludeBottom = dlgInit.functionPnl.excludeBottom.value;
                excludeRight = dlgInit.functionPnl.excludeRight.value;
                excludeLeft = dlgInit.functionPnl.excludeLeft.value;
        }

        for (i=0; i<onePointPathsToProcess.length; i++) {
                newPath = sandboxLayer.pathItems.add();
                if (onePointPathsToProcess[i].closed) {
                        newPath.closed = true;
                }
                else {
                        newPath.closed = false;
                }
                newPath.stroked = true;
                newPath.filled = false;
                newPath.strokeColor = newPathColor;
                newPath.strokeWidth = 0.25;
                for (j=0; j<onePointPathsToProcess[i].pathPoints.length; j++) {
                        newPoint = clonePointToPath(onePointPathsToProcess[i].pathPoints[j], newPath);
                }
        }

        for (i=0; i<twoPointPathsToProcess.length; i++) {
                newPath = sandboxLayer.pathItems.add();
                newPath.closed = false;
                newPath.stroked = true;
                newPath.filled = false;
                newPath.strokeColor = newPathColor;
                newPath.strokeWidth = 0.25;

                for (j=0; j<twoPointPathsToProcess[i].pathPoints.length; j++) {
                        if (twoPointPathsToProcess[i].pathPoints[j].selected == PathPointSelection.ANCHORPOINT) {
                                firstSelectedIndex = j;
                                break;
                        }
                }
                for (j=twoPointPathsToProcess[i].pathPoints.length-1; j>=0; j--) {
                        if (twoPointPathsToProcess[i].pathPoints[j].selected == PathPointSelection.ANCHORPOINT) {
                                lastSelectedIndex = j;
                                break;
                        }
                }
                if (twoPointPathsToProcess[i].closed) {
                        if (shorter || longer) {
                                var firstLastLength = getPathSegmentLength(twoPointPathsToProcess[i], firstSelectedIndex, lastSelectedIndex);
                                var lastFirstLength = getPathSegmentLength(twoPointPathsToProcess[i], lastSelectedIndex, firstSelectedIndex);
                                if ((firstLastLength > lastFirstLength && shorter) ||
                                    (lastFirstLength > firstLastLength && longer)) {
                                        referenceIndex = lastSelectedIndex;
                                }
                                else {
                                        referenceIndex = 0;
                                }
                        }
                        else if (includeTop || excludeTop) {
                                referenceIndex = findHighestPathPoint(twoPointPathsToProcess[i]);
                        }
                        else if (includeBottom || excludeBottom) {
                                referenceIndex = findLowestPathPoint(twoPointPathsToProcess[i]);
                        }
                        else if (includeRight || excludeRight) {
                                referenceIndex = findRightmostPathPoint(twoPointPathsToProcess[i]);
                        }
                        else if (includeLeft || excludeLeft) {
                                referenceIndex = findLeftmostPathPoint(twoPointPathsToProcess[i]);
                        }

                        if ((excludeTop || excludeBottom || excludeRight || excludeLeft ||
                             includeTop || includeBottom || includeRight || includeLeft) &&
                            (referenceIndex == firstSelectedIndex || referenceIndex == lastSelectedIndex)) {
                                alert("A selected point on the closed path matches the chosen extremum criteria. Path skipped.");
                                newPath.remove();
                        }
                        else if (((shorter || longer || excludeTop || excludeBottom || excludeRight || excludeLeft) &&
                                  (referenceIndex <= firstSelectedIndex || referenceIndex > lastSelectedIndex)) ||
                                 ((includeTop || includeBottom || includeRight || includeLeft) &&
                                  (referenceIndex > firstSelectedIndex && referenceIndex < lastSelectedIndex))){
                                for (j=firstSelectedIndex; j<=lastSelectedIndex; j++) {
                                        newPoint = clonePointToPath(twoPointPathsToProcess[i].pathPoints[j], newPath);
                                }
                        }
                        else {
                                for (j=lastSelectedIndex; j<twoPointPathsToProcess[i].pathPoints.length; j++) {
                                        newPoint = clonePointToPath(twoPointPathsToProcess[i].pathPoints[j], newPath);
                                }
                                for (j=0; j<=firstSelectedIndex; j++) {
                                        newPoint = clonePointToPath(twoPointPathsToProcess[i].pathPoints[j], newPath);
                                }
                        }
                }
                else {
                        for (j=firstSelectedIndex; j<=lastSelectedIndex; j++) {
                                newPoint = clonePointToPath(twoPointPathsToProcess[i].pathPoints[j], newPath);
                        }
                }
        }
        if (sandboxNotVisible) {
                sandboxLayer.visible = false;
        }
}
catch(er)
{
        if (exitError == 5) {
                alert("At least one path open or closed must be selected.\nA selected path can be one path of a compound path.\n");
        }
        if (exitError == 99) {
                alert("ACK! Unexplained error\n");
        }
}

/*******************************************************************************
/*******************************************************************************
* Dialog Code
*/

/*******************************************************************************
 * Function: doInitDialog
 */
function doInitDialog(dlgInit) {

        /* Add radio buttons to control functionality */
        dlgInit.functionPnl = dlgInit.add('panel', undefined, 'Identification of path segment to copy');
        dlgInit.functionPnl.length = dlgInit.functionPnl.add('statictext', undefined, 'By length');
        (dlgInit.functionPnl.shorter = dlgInit.functionPnl.add('radiobutton', undefined, 'Shorter' )).helpTip = "The desired segment is the shorter one.";
        (dlgInit.functionPnl.longer = dlgInit.functionPnl.add('radiobutton', undefined, 'Longer' )).helpTip = "The desired segment is the longer one.";
        (dlgInit.functionPnl.includeTop = dlgInit.functionPnl.add('radiobutton', undefined, 'Include Topmost' )).helpTip = "The desired segment contains the topmost anchor point.";
        (dlgInit.functionPnl.includeBottom = dlgInit.functionPnl.add('radiobutton', undefined, 'Include Bottommost' )).helpTip = "The desired segment contains the bottommost point.";
        (dlgInit.functionPnl.includeRight = dlgInit.functionPnl.add('radiobutton', undefined, 'Include Rightmost' )).helpTip = "The desired segment contains the rightmost point.";
        (dlgInit.functionPnl.includeLeft = dlgInit.functionPnl.add('radiobutton', undefined, 'Include Leftmost' )).helpTip = "The desired segment contains the leftmost point.";
        (dlgInit.functionPnl.excludeTop = dlgInit.functionPnl.add('radiobutton', undefined, 'Exclude Topmost' )).helpTip = "The desired segment does not contain the topmost anchor point.";
        (dlgInit.functionPnl.excludeBottom = dlgInit.functionPnl.add('radiobutton', undefined, 'Exclude Bottommost' )).helpTip = "The desired segment does not contain the bottommost point.";
        (dlgInit.functionPnl.excludeRight = dlgInit.functionPnl.add('radiobutton', undefined, 'Exclude Rightmost' )).helpTip = "The desired segment does not contain the rightmost point.";
        (dlgInit.functionPnl.excludeLeft = dlgInit.functionPnl.add('radiobutton', undefined, 'Exclude Leftmost' )).helpTip = "The desired segment does not contain the leftmost point.";
        dlgInit.functionPnl.shorter.value = true;
        dlgInit.functionPnl.alignChildren='left';
        dlgInit.functionPnl.orientation='column';

        /* Add execution buttons */
        dlgInit.executeGrp = dlgInit.add('group', undefined, 'Execute:');
        dlgInit.executeGrp.orientation='row';
        dlgInit.executeGrp.buildBtn1= dlgInit.executeGrp.add('button',undefined, 'Cancel', {name:'cancel'});
        dlgInit.executeGrp.buildBtn2 = dlgInit.executeGrp.add('button', undefined, 'OK', {name:'ok'});
        dlgInit.executeGrp.buildBtn1.onClick= initActionCanceled;
        dlgInit.executeGrp.buildBtn2.onClick= initActionOk;

        dlgInit.frameLocation = [100, 100];
        dlgInit.show();

        return dlgInit;
}

function initActionCanceled() {
        exitError = 1;
        dlgInit.hide();
}

function initActionOk() {
        var proceed = true;

        exitError = 0;
        dlgInit.hide();
}
