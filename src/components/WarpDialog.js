import React from 'react';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { SpinButton } from 'office-ui-fabric-react/lib/SpinButton';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import UserStore from './Styles';

import STTApi from 'sttapi';
import { CONFIG, getChronitonCount } from 'sttapi';

export class WarpDialog extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showDialog: false,
            iconUrl: '',
            warpCount: 1,
            quest: undefined
        };

        this._closeDialog = this._closeDialog.bind(this);
        this.show = this.show.bind(this);
    }

    show(id, mastery_level) {
        for (let mission of STTApi.missions) {
			let quest = mission.quests.find(q => q.id === id);
			if (quest) {
                let mastery = quest.mastery_levels[mastery_level];

                STTApi.imageProvider.getImageUrl(quest.timeline_icon.file, quest).then((found) => {
                    this.setState({ iconUrl: found.url});
                }).catch((error) => { console.warn(error); });

                this.setState({
                    showDialog: true,
                    quest,
                    mastery,
                    mastery_level
                });
    
                break;
            }
		}
    }

    _closeDialog() {
        this.setState({
            showDialog: false,
            iconUrl: '',
            warpCount: 1,
            quest: undefined
        });
    }

    async _warp(warpCount) {
        while (warpCount > 10) {
            let ephemerals = await STTApi.warpQuest(this.state.quest.id, this.state.mastery_level, 10);
            // TODO: show rewards to the user somehow
            console.log(ephemerals);

            warpCount -= 10;
        }

        if (warpCount > 0) {
            let ephemerals = await STTApi.warpQuest(this.state.quest.id, this.state.mastery_level, warpCount);
            // TODO: show rewards to the user somehow
            console.log(ephemerals);
        }

        this._closeDialog();

        if (this.props.onWarped) {
            this.props.onWarped();
        }
    }

    render() {
        if (!this.state.showDialog || !this.state.quest) {
            return <span />;
        }

        let chronAvailable = getChronitonCount();
        let chronNeeded = this.state.mastery.energy_cost * this.state.warpCount;

        let currentTheme = UserStore.get('theme');

        return <Dialog
            hidden={!this.state.showDialog}
            onDismiss={this._closeDialog}
            dialogContentProps={{
                type: DialogType.normal,
                title: `Warp mission '${this.state.quest.name}' on ${CONFIG.MASTERY_LEVELS[this.state.mastery_level].name}`
            }}
            modalProps={{
                containerClassName: 'warpdialogMainOverride',
                isBlocking: true
            }}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gridTemplateAreas: `'image description' 'image chronitons' 'image warpcount'`, color: currentTheme.semanticColors.bodyText, backgroundColor: currentTheme.semanticColors.bodyBackground }}>
                <div style={{ gridArea: 'image' }}><Image src={this.state.iconUrl} width={200} height={200} imageFit={ImageFit.contain} /></div>
                <div style={{ gridArea: 'description' }}>
                    <p>{this.state.quest.description}</p>
                    {this.state.mastery.locked && <p>This mission is locked; you can't warp it until you complete this mastery level in the game</p>}
                    <p><b>NOTE:</b> This feature is experimental; let me know how it worked for you.</p>
                </div>
                <div style={{ gridArea: 'chronitons' }}>
                    <p>Chronitons needed: {chronNeeded} / {chronAvailable}</p>
                </div>
                <div style={{ gridArea: 'warpcount' }}>
                    <SpinButton value={this.state.warpCount} label={'Warp count:'} min={1} max={10} step={1}
						onIncrement={(value) => { this.setState({ warpCount: +value + 1 }); }}
						onDecrement={(value) => { this.setState({ warpCount: +value - 1 }); }}
					/>
                </div>
            </div>

            <DialogFooter>
                <PrimaryButton onClick={() => this._warp(10)} text='Warp 10' disabled={((this.state.mastery.energy_cost * 10) > chronAvailable) || this.state.mastery.locked} />
                <PrimaryButton onClick={() => this._warp(this.state.warpCount)} text={`Warp ${this.state.warpCount}`} disabled={(chronNeeded > chronAvailable) || this.state.mastery.locked} />
                <DefaultButton onClick={() => this._closeDialog()} text='Cancel' />
            </DialogFooter>
        </Dialog>;
    }
}