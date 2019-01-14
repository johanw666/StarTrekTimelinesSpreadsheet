import React from 'react';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';

import { CrewList } from './CrewList.js';

import STTApi from 'sttapi';

export class CrewDuplicates extends React.Component {
    constructor(props) {
        super(props);

        this.state = Object.assign({ hideConfirmationDialog: true }, this._loadDuplicates());

        this._loadDuplicates = this._loadDuplicates.bind(this);
        this._onSelectionChange = this._onSelectionChange.bind(this);
        this._dismissDupes = this._dismissDupes.bind(this);
        this._closeConfirmationDialog = this._closeConfirmationDialog.bind(this);
        this._dismissConfirmationDialog = this._dismissConfirmationDialog.bind(this);
        this._openConfirmationDialog = this._openConfirmationDialog.bind(this);
    }

    componentDidMount() {
        this._updateCommandItems();
    }

    _updateCommandItems() {
        if (this.state.selectedIds && (this.state.selectedIds.size > 0)) {
            if (this.props.onCommandItemsUpdate) {
                this.props.onCommandItemsUpdate([{
                    key: 'dismiss',
                    text: `Dismiss ${this.state.selectedIds.size} dupes`,
                    iconProps: { iconName: 'Delete' },
                    onClick: () => {
                        this._openConfirmationDialog();
                    }
                }]);
            }
        } else {
            if (this.props.onCommandItemsUpdate) {
                this.props.onCommandItemsUpdate([]);
            }
        }
    }

    _loadDuplicates() {
        let uniq = STTApi.roster.filter((crew) => !crew.buyback)
            .map((crew) => { return { count: 1, crewId: crew.id }; })
            .reduce((a, b) => {
                a[b.crewId] = (a[b.crewId] || 0) + b.count;
                return a;
            }, {});

        let duplicateIds = Object.keys(uniq).filter((a) => uniq[a] > 1);

        let duplicates = STTApi.roster.filter((crew) => duplicateIds.includes(crew.id.toString()));

        let selectedIds = new Set();
        duplicates.forEach(crew => {
            if ((crew.level === 1) && (crew.rarity === 1)) {
                // TODO: only if player already has it FFFE
                selectedIds.add(crew.crew_id);
            }
        });

        return {duplicates, selectedIds};
    }

    _onSelectionChange(selectedIds) {
        this.setState({ selectedIds }, () => { this._updateCommandItems(); });
    }

    _dismissDupes() {
        let promises = [];
        this.state.selectedIds.forEach(id => {
            promises.push(STTApi.sellCrew(id));
        });

        return Promise.all(promises).catch((reason) => console.warn(reason)).then(() => STTApi.refreshRoster()).then(() => {
            this.setState({
                duplicates: this._loadDuplicates(),
                selectedIds: new Set()
            });
        });
    }

    _dismissConfirmationDialog() {
        this._dismissDupes().then(() => {
            this.setState({ hideConfirmationDialog: true });
        });
    }

    _openConfirmationDialog() {
        this.setState({ hideConfirmationDialog: false });
    }

    _closeConfirmationDialog() {
        this.setState({ hideConfirmationDialog: true });
    }

    renderConfirmationDialogContent() {
        if (!this.state.selectedIds || (this.state.selectedIds.size === 0)) {
            return <span/>;
        }

        let crewList = [];
        this.state.selectedIds.forEach(id => {
            let crew = STTApi.roster.find(c => c.crew_id === id);
            if (!crew) return;

            if ((crew.level === 1) && (crew.rarity === 1)) {
                crewList.push(<span>
                    <b>{crew.name}</b> (level {crew.level}, rarity {crew.rarity})
				</span>);
            } else {
                crewList.push(<span style={{ color: 'red', fontWeight: 'bold' }}>
                    <b>{crew.name}</b> (level {crew.level}, rarity {crew.rarity})
				</span>);
            }
        });

        return <div>{crewList.reduce((prev, curr) => [prev, ', ', curr])}</div>;
    }

    render() {
        if (this.state.duplicates.length > 0) {
            return (<div className='tab-panel' data-is-scrollable='true'>
                <CrewList data={this.state.duplicates} duplicatelist={true} sortColumn='name' selectedIds={this.state.selectedIds} onSelectionChange={this._onSelectionChange} embedded={true} />
                <Dialog
                    hidden={this.state.hideConfirmationDialog}
                    onDismiss={this._closeConfirmationDialog}
                    dialogContentProps={{
                        type: DialogType.normal,
                        title: 'Are you sure?',
                        subText: `You are about to dismiss ${this.state.selectedIds.size} crew.`
                    }}
                    modalProps={{
                        isBlocking: true
                    }}
                >
                    <div>
                        {this.renderConfirmationDialogContent()}
                    </div>
                    <DialogFooter>
                        <PrimaryButton onClick={this._dismissConfirmationDialog} text="Dismiss" />
                        <DefaultButton onClick={this._closeConfirmationDialog} text="Cancel" />
                    </DialogFooter>
                </Dialog>
            </div>);
        }
        else {
            return <span />;
        }
    }
}