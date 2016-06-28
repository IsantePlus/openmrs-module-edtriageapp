angular.module("edTriageViewQueueController", [])
    .controller("viewQueueController", ['$scope', '$interval', '$filter', 'EdTriageDataService', 'EdTriageConcept', 'locationUuid', 'serverDateTimeInMillis',
        function ($scope, $interval, $filter, EdTriageDataService, EdTriageConcept, locationUuid, serverDateTimeInMillis) {
            console.log("locationUuid=" + locationUuid);
            // used to determine if we should disable things
            $scope.isSaving = false;
            $scope.lastUpdatedAtInMillis = new Date().getTime();
            $scope.serverTimeDelta = $scope.lastUpdatedAtInMillis - serverDateTimeInMillis;
            $scope.lastUpdatedAtStr = "2:00 ";
            $scope.triageStatusCodes =  EdTriageConcept.status;
            $scope.debug = false;
            $scope.dataRefreshIntervalInSeconds = 120;
            $scope.timerRefreshIntervalInSeconds = 10;
            /*  loads the patient list
             * */
            $scope.loadPatientData = function(){
                $scope.lastUpdatedAtInMillis = new Date().getTime();
                return EdTriageDataService.loadQueue($scope.edTriagePatientConcept, locationUuid).then(function(edTriagePatientQueue){
                    $scope.edTriagePatientQueue = edTriagePatientQueue.data;
                });
            };
            /*
            loads all the data
             */
            $scope.loadData = function(){
                $scope.lastUpdatedAtInMillis = new Date().getTime();
                return EdTriageDataService.loadConcept().then(function (concept) {
                    $scope.edTriagePatientConcept = concept;
                    return $scope.loadPatientData(locationUuid).then(function(edTriagePatientQueue){});
                });
            };


            /*
             * the changes the status of the observation to consult
             * */
            $scope.beginConsult = function (edTriagePatient) {
                $scope.isSaving = true;

                return EdTriageDataService.beginConsult($scope.edTriagePatientConcept , edTriagePatient).then(function(res){
                    $scope.isSaving = false;
                    if(res.status != 200){
                        alert("The system was not able to update the record");
                        $scope.message = {type: 'danger', text: $filter('json')(res.data)};
                    }
                    else{
                        //just reload the data, there might be new ones in the queue
                        //return $scope.loadPatientData();
                        var url = EdTriageDataService.CONSTANTS.URLS.PATIENT_DASHBOARD.replace("PATIENT_UUID", edTriagePatient.patient.uuid);
                        emr.navigateTo({ applicationUrl: url});

                    }
                });
                
            };

            /*
             * the changes the status of the observation to consult
             * */
            $scope.removeEdTriage = function (edTriagePatient) {
                $scope.isSaving = true;
                return EdTriageDataService.removeConsult($scope.edTriagePatientConcept,  edTriagePatient).then(function(res){
                    $scope.isSaving = false;
                    if(res.status != 200){
                        alert("The system was not able to remove the record");
                        $scope.message = {type: 'danger', text: $filter('json')(res.data)};
                    }
                    else{
                        //just reload the data, there might be new ones in the queue
                        return $scope.loadPatientData();
                    }

                });
            };


            /* builds a link to the patient edit page*/
            $scope.getPatientLink = function(uuid, appId){
                return "edtriageEditPatient.page?patientId=" + uuid + "&appId=" + appId;
            };

            $scope.listofVitalsAsLabelsAndValues = function(edTriagePatient){
                var ret = [];
                if(edTriagePatient.vitals.respiratoryRate != null){
                    ret.push({label: $scope.edTriagePatientConcept.vitals.respiratoryRate.label , value:edTriagePatient.vitals.respiratoryRate.value});
                }
                if(edTriagePatient.vitals.heartRate != null){
                    ret.push({label: $scope.edTriagePatientConcept.vitals.respiratoryRate.label , value:edTriagePatient.vitals.respiratoryRate.value});
                }


                return ret;
            };

            /* checkes whether at least one symptom was answered*/
            $scope.hasSymptoms = function(edTriagePatient){
                for(var prop in edTriagePatient.symptoms){
                    var v = edTriagePatient.symptoms[prop].value;
                    if(v != null){
                        return true;
                    }
                }
                return false;

            };

            /* helper function to get the color class for the score
             * @param {String} colorCode - the uuid for the color
             * @return the class suffix
             * */
            $scope.getColorClass = function(concept, edTriagePatient, uuid){
                var score = $scope.getScoreForProp(concept, edTriagePatient, uuid);
                return $scope.getColorClassFromScore(score);
            };

            /* helper function to get the color class for the score
             * @param {String} colorCode - the uuid for the color
             * @return the class suffix
             * */
            $scope.getColorClassFromScore = function(score){
                var color =  EdTriageDataService.getColorClass(score);
                if(color == null){
                    //this means we didn't have a color, it's some kind of numeric score,
                    //so just use the default val
                    color = 'score';
                }
                return color;
            };

            $scope.getScoreForProp = function(concept, edTriagePatient, uuid){
                if(uuid == null){
                    return -1;
                }
                var answer = $scope.findAnswer(concept, uuid);
                var score = answer.score(edTriagePatient.patient.ageType, uuid);
                return score;

            } ;

            /* helper function for finding an answer for a question in the concept def
            * @param {EdTriageConcept} concept - the concepts
            * @param {String} uuid - the answer UUID
            * @return the answer object
            * */
            $scope.findAnswer = function(concept, uuid){
                return $filter('findAnswer')(concept, uuid);
            };

            /* the timer to refresh updates*/
            var stopTimeUpdates;
            $scope.startUpdateTime = function() {

                // Don't start a new fight if we are already fighting
                if ( angular.isDefined(stopTimeUpdates) ) return;

                stopTimeUpdates = $interval(function() {
                    var refreshInterval = $scope.dataRefreshIntervalInSeconds;
                    //$scope.serverTimeDelta = $scope.lastUpdatedAtInMillis - serverDateTimeInMillis;
                    
                    
                    var diff = refreshInterval - ((new Date().getTime()) - $scope.lastUpdatedAtInMillis)/1000;

                    if(diff <= 0){
                        //refresh every 2 minutes
                        $scope.loadData();
                        return;
                    }

                    var minutes = Math.floor(diff / 60);
                    var seconds = Math.floor(diff % 60);
                    if(seconds < 10){
                        seconds = "0" + seconds;
                    }

                    $scope.lastUpdatedAtStr = minutes + ":" + seconds;
                }, $scope.timerRefreshIntervalInSeconds*1000);
            };

            $scope.stopUpdateTime = function() {
                if (angular.isDefined(stopTimeUpdates)) {
                    $interval.cancel(stopTimeUpdates);
                    stopTimeUpdates = undefined;
                }
            };

            $scope.$on('$destroy', function() {
                // Make sure that the interval is destroyed too
                $scope.stopUpdateTime();
            });

            /* ---------------------------------------------------------
             *  page initialization code starts here
             * -------------------------------------------------------- */
            $scope.loadData();
            $scope.startUpdateTime();


        }]).directive('showIfHasValue', function () {
        return {
            restrict: 'E',
            scope: {
                itemValue: "=",
                itemLabel: "=",
                color:"=",
                score: "="
            },
            template:
                "<li class='edtriage-queue-list-item' ng-if='itemValue && score != 0'>" +
                "<span class='label edtriage-label-{{color}}'><span ng-if='score*1==score'>{{score}}</span><span ng-if='score*1!=score'>&nbsp;&nbsp;</span></span>" +
                "&nbsp;{{itemLabel}}: {{itemValue}}</li>"
        };
    }).directive('showListItemIfHasValue', function () {
    return {
        restrict: 'E',
        scope: {
            itemValue: "=",
            itemLabel:"=",
            color: "=",
            score:"="
        },
        template:
            "<li  class='edtriage-queue-list-item' ng-if='itemValue && score != 0'><span class='label edtriage-label-{{color}}'><span ng-if='score*1==score'>{{score}}</span><span ng-if='score*1!=score'>&nbsp;&nbsp;</span></span>&nbsp;{{itemLabel}}</li>"
    };
});